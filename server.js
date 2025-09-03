import express from 'express';
import cors from 'cors';
import { calculatePropertyInvestment } from './calculator.js';
import { getUnixTimestampFourYearsLater, getUnixTimestampThreeYearsLater } from './helpers/dateTime.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Cashflow Calculator API is running',
    timestamp: new Date().toISOString()
  });
});

// Common calculation logic
const performCalculation = (body) => {
  const {
    acquisitionPrice,
    tenure,
    holdingPeriod,
    constructionCompletionDate,
    finalPrice,
    interestRate,
    selectedCharge,
    assetType
  } = body;

  if (!acquisitionPrice || !finalPrice || !tenure || !holdingPeriod || !assetType) {
    throw new Error('Missing required fields: acquisitionPrice, finalPrice, tenure, holdingPeriod, assetType');
  }

  const defaultConstructionCompletionDate = assetType === 'plot' 
    ? getUnixTimestampThreeYearsLater() 
    : getUnixTimestampFourYearsLater();

  const defaultTenure = 20;
  const defaultHoldingPeriod = assetType === 'plot'  ? 3 : 4;


  // Use provided date or default
  const finalConstructionDate = constructionCompletionDate || defaultConstructionCompletionDate;
  const finalTenure = tenure || defaultTenure;
  const finalHoldingPeriod = holdingPeriod || defaultHoldingPeriod;

  const data = {
    acquisitionPrice: acquisitionPrice,
    tenure: finalTenure,
    holdingPeriod: finalHoldingPeriod,
    constructionCompletionDate: finalConstructionDate,
    finalPrice: finalPrice,
    interestRate: interestRate || 8.5,
    loanPercentage: assetType === 'plot' ? 75 : 85,
    selectedCharge: selectedCharge || 'Stamp Duty',
    assetType: assetType
  };

  const result = calculatePropertyInvestment(data);
  
  if (result.error) {
    throw new Error(result.error);
  }

  const response = {
    success: true,
    data: result
  };

  // Add warning if default construction date was used
  if (!constructionCompletionDate) {
    response.warning = `Construction completion date not provided, using default date based on asset type: ${assetType || 'apartment'}`;
  }

  return response;
};



app.post('/api/investmentReport', (req, res) => {
  try {
    const result = performCalculation(req.body);
    res.json(result);
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cashflow Calculator API is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Full Report endpoint: POST http://localhost:${PORT}/api/investmentReport`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit();

});
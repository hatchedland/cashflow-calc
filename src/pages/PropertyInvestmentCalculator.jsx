import React, { useState } from 'react';
import { Calculator, Home, TrendingUp, DollarSign, Calendar, Percent } from 'lucide-react';
import moment from 'moment';

// Import the createReport function (copied from the provided code)
function formatCost(price) {
  if (price === undefined || price === null) return;
  
  let isNegative = false;
  if (price < 0) {
    isNegative = true;
    price = Math.abs(price);
  }
  
  let priceStr = price.toString().replace(/,/g, "");
  let [integerPart, decimalPart] = priceStr.split(".");
  
  let lastThree = integerPart.slice(-3);
  let otherNumbers = integerPart.slice(0, -3);
  
  if (otherNumbers) {
    lastThree = "," + lastThree;
  }
  
  otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  
  let formattedPrice = `₹${otherNumbers}${lastThree}`;
  if (decimalPart) {
    formattedPrice += `.${decimalPart}`;
  }
  
  if (isNegative) formattedPrice = `-${formattedPrice}`;
  
  return formattedPrice;
}

function calculateLoanDisbursement(quarters, totalLoanAmount, assetType) {
  if (!Array.isArray(quarters) || !totalLoanAmount || !assetType) {
    throw new Error("Invalid input for calculateLoanDisbursement.");
  }

  const numQuarters = quarters.length;
  let disbursement = [];

  const apartmentDistributions = {
    4: [0.4, 0.3, 0.15, 0.15],
    3: [0.7, 0.15, 0.15],
    2: [0.85, 0.15],
    1: [1.0]
  };

  const plotDistributions = {
    2: [0.5, 0.5],
    1: [1.0]
  };

  if (assetType === "plot") {
    if (numQuarters <= 4) {
      const share = totalLoanAmount / numQuarters;
      disbursement = Array(numQuarters).fill(+(share.toFixed(2)));
    } else {
      const firstHalf = totalLoanAmount * 0.5;
      const secondHalf = totalLoanAmount * 0.5;
      const firstQuarterShare = firstHalf / 4;
      const remainingQuarterShare = secondHalf / (numQuarters - 4);

      for (let i = 0; i < 4; i++) {
        disbursement.push(+(firstQuarterShare.toFixed(2)));
      }
      for (let i = 4; i < numQuarters; i++) {
        disbursement.push(+(remainingQuarterShare.toFixed(2)));
      }
    }
  } else if (assetType === "apartment" || assetType === "villa") {
    const distributions = apartmentDistributions;
    let percentages;
    
    if (numQuarters >= 13) {
      percentages = distributions[4];
    } else if (numQuarters >= 9) {
      percentages = distributions[3];
    } else if (numQuarters >= 5) {
      percentages = distributions[2];
    } else {
      percentages = distributions[1];
    }

    const years = percentages.length;
    const quartersPerYear = Math.floor(numQuarters / years);
    const remainderQuarters = numQuarters % years;

    percentages.forEach((percentage, i) => {
      const totalQuarters = i < years - 1 ? quartersPerYear : quartersPerYear + remainderQuarters;
      for (let j = 0; j < totalQuarters; j++) {
        disbursement.push(+(totalLoanAmount * (percentage / totalQuarters)).toFixed(2));
      }
    });
  } else {
    throw new Error("Invalid assetType. Use 'plot', 'apartment', or 'villa'.");
  }

  return disbursement;
}

function calculateIRRMonthly(values, initialGuess = 0.05) {
  const irrResult = (values, rate) => {
    const r = rate + 1;
    let result = values[0];
    for (let i = 1; i < values.length; i++) {
      const timeFraction = i / 12;
      result += values[i] / Math.pow(r, timeFraction);
    }
    return result;
  };

  const irrResultDeriv = (values, rate) => {
    const r = rate + 1;
    let result = 0;
    for (let i = 1; i < values.length; i++) {
      const timeFraction = i / 12;
      result -= (timeFraction * values[i]) / Math.pow(r, timeFraction + 1);
    }
    return result;
  };

  const hasPositive = values.some(v => v > 0);
  const hasNegative = values.some(v => v < 0);
  if (!hasPositive || !hasNegative) return "#NUM!";

  let guess = initialGuess;
  const epsMax = 1e-8;
  const iterMax = 100;

  let resultRate = guess;
  for (let iteration = 0; iteration < iterMax; iteration++) {
    const resultValue = irrResult(values, resultRate);
    const derivValue = irrResultDeriv(values, resultRate);

    if (Math.abs(derivValue) < epsMax) break;

    const newRate = resultRate - resultValue / derivValue;
    if (Math.abs(newRate - resultRate) < epsMax) return newRate;

    resultRate = newRate;
  }

  return "#NUM!";
}

function createReport(data) {
  try {
    let { acquisitionPrice, tenure, holdingPeriod, constructionCompletionDate, finalPrice, interestRate, loanPercentage, selectedCharge, assetType } = data;

    if(!constructionCompletionDate) {
      constructionCompletionDate = "2026-12-31";
    }

    const bookingDate = moment();
    let constructionDate = moment(constructionCompletionDate, "YYYY-MM-DD");
    let quarterDate = moment(bookingDate).add(3, 'months');
    
    if(constructionDate.isBefore(quarterDate)){
      constructionDate = quarterDate.clone().add(1, 'year');
    }
    
    const monthlyInterestRate = interestRate / 12 / 100;
    const bookingAmount = 0.10 * acquisitionPrice;
    const possessionPercent = Math.min(5, 90-loanPercentage);
    const possessionAmount = (possessionPercent/100) * acquisitionPrice;
    const handoverPeriod = constructionDate.year()- bookingDate.year();
    const transferOrStampRegCharges= (handoverPeriod>= holdingPeriod) ?  parseFloat(acquisitionPrice* 0.020)  : parseFloat(acquisitionPrice* 0.065);
    let transferOrStamp =  (handoverPeriod>= holdingPeriod) ? 0 : 1;
    const remainingLoanAmount = (loanPercentage/100) * acquisitionPrice;
    const AmountToBuilderPer =(Math.max(0, 85-loanPercentage)); 
    const AmountToBuilder = (AmountToBuilderPer/100) * acquisitionPrice;
    let cagr = (Math.pow(finalPrice / acquisitionPrice, 1 / holdingPeriod) - 1);

    const quarters = [];
    while (quarterDate.isBefore(constructionDate)) {
        quarters.push(quarterDate.clone());
        quarterDate.add(3, 'months');
    }

    let maxQuartersLength;
    if(assetType==='apartment')
      maxQuartersLength = Math.min(16, quarters.length);
    if(assetType==='plot')
      maxQuartersLength = Math.min(8, quarters.length);
    
    while(quarters.length>maxQuartersLength)
      quarters.pop();

    const disbursment = calculateLoanDisbursement(quarters,remainingLoanAmount,assetType);        
    let loanAmount = 0;
    let table = [];
    let cashflows = [];
    let yearlyEmiSum = 0;
    let currentDate = moment(bookingDate);
    let totalMonths = tenure * 12;
    let totalHoldingMonths= holdingPeriod * 12;
    let monthsPassed = 0;
    let amtDisbursed=0;
    let yearlyBuilderAmt=0;
    let isExtraChargeAndPossessionConsiderForYearly=false;
    let isExtraChargeAndPossessionConsiderForMonthly=false;
    let currentQuarter=0;

    for (let i = 0; i < Math.min(totalMonths, totalHoldingMonths); i++) {
        const isQuarter = quarters.some(quarter => quarter.isSame(currentDate, 'month'));
        if (isQuarter) {
            loanAmount += (disbursment[currentQuarter]);
            amtDisbursed += (disbursment[currentQuarter]);
            currentQuarter++;
        }

        let monthlyBuilderAmt=0;
        const openingLoanAmount = loanAmount;
        const interest = loanAmount * monthlyInterestRate;
        let emi = (loanAmount * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, - (tenure*12 - monthsPassed)));
        const principal = emi - interest;
        const closingLoanAmount = loanAmount - emi + interest;
        
        let finalMonthlyCashflow= (emi)? (-emi) : 0;
        let monthlyOthersCashFlow=0;
        const monthlyOthersCashFlowComponents= [];

        if(currentDate.month() === bookingDate.month() && currentDate.year() === bookingDate.year()){
          finalMonthlyCashflow -= bookingAmount;
          monthlyOthersCashFlow+=bookingAmount;
          monthlyOthersCashFlowComponents.push(`down payment (-${formatCost(parseInt(bookingAmount))})`);
          if(AmountToBuilder){
            finalMonthlyCashflow -= AmountToBuilder;
            monthlyBuilderAmt+=AmountToBuilder;
            yearlyBuilderAmt+=AmountToBuilder;
            monthlyOthersCashFlow+=AmountToBuilder;
            monthlyOthersCashFlowComponents.push(`builder's remaining amount (-${formatCost(parseInt(AmountToBuilder))})`);
          }
        } 
        
        if(currentDate.month() === constructionDate.month() && currentDate.year() === constructionDate.year()){
          finalMonthlyCashflow-=(possessionAmount+transferOrStampRegCharges);
          monthlyOthersCashFlow+=(possessionAmount+transferOrStampRegCharges);
          monthlyOthersCashFlowComponents.push(`possession amount (-${formatCost(parseInt(possessionAmount))})`);

          if(transferOrStamp===1)
            monthlyOthersCashFlowComponents.push(`stamp duty & registraion charges (-${formatCost(parseInt(transferOrStampRegCharges))})`);
          else 
            monthlyOthersCashFlowComponents.push(`transfer fees (-${formatCost(parseInt(transferOrStampRegCharges))})`);

          isExtraChargeAndPossessionConsiderForMonthly=true;
          monthlyBuilderAmt+=(possessionAmount);
          yearlyBuilderAmt+=possessionAmount
        }

        if(!isExtraChargeAndPossessionConsiderForMonthly && i=== Math.min(totalMonths, totalHoldingMonths)-1){
          finalMonthlyCashflow-=(possessionAmount+transferOrStampRegCharges);
          monthlyOthersCashFlow+=(possessionAmount+transferOrStampRegCharges);
          monthlyOthersCashFlowComponents.push(`possession amount (-${formatCost(parseInt(possessionAmount))})`);

          if(transferOrStamp===1)
            monthlyOthersCashFlowComponents.push(`stamp duty & registraion charges (-${formatCost(parseInt(transferOrStampRegCharges))})`);
          else 
            monthlyOthersCashFlowComponents.push(`transfer fees (-${formatCost(parseInt(transferOrStampRegCharges))})`);   

          isExtraChargeAndPossessionConsiderForMonthly=true;
          monthlyBuilderAmt+=(possessionAmount);
          yearlyBuilderAmt+=possessionAmount
        }

        if(i=== Math.min(totalMonths, totalHoldingMonths)-1){
          finalMonthlyCashflow +=  finalPrice;
          finalMonthlyCashflow-= closingLoanAmount;
          finalMonthlyCashflow -= parseInt(remainingLoanAmount - amtDisbursed);

          monthlyOthersCashFlow-= finalPrice;
          monthlyOthersCashFlow+= closingLoanAmount;
          monthlyOthersCashFlow+= parseInt(remainingLoanAmount - amtDisbursed);

          monthlyOthersCashFlowComponents.push(`selling price (+${formatCost(parseInt(finalPrice))})`);
          monthlyOthersCashFlowComponents.push(`loan repayment at sale (-${formatCost(parseInt(closingLoanAmount))})`);

          if(parseInt(remainingLoanAmount - amtDisbursed))
            monthlyOthersCashFlowComponents.push(`remaining loan disbursed amount (-${formatCost(parseInt(remainingLoanAmount - amtDisbursed))})`);

          monthlyBuilderAmt+= parseInt(remainingLoanAmount - amtDisbursed);
          yearlyBuilderAmt+= parseInt(remainingLoanAmount - amtDisbursed);
        }

        table.push([
            currentDate.format('MMMM YYYY'),
            openingLoanAmount.toFixed(2),
            {value:monthlyOthersCashFlow.toFixed(2), components:monthlyOthersCashFlowComponents},
            emi.toFixed(2),
            interest.toFixed(2),
            principal.toFixed(2),
            closingLoanAmount.toFixed(2),
            monthlyBuilderAmt.toFixed(2),
            finalMonthlyCashflow,
        ]);

        loanAmount = closingLoanAmount;
        yearlyEmiSum += emi;

        if (currentDate.month() === 11) {
          cashflows.push(-(yearlyEmiSum + yearlyBuilderAmt)); 
          yearlyEmiSum = 0;
          yearlyBuilderAmt=0; 

          if(!isExtraChargeAndPossessionConsiderForYearly && currentDate.year() === constructionDate.year()){    
            cashflows[cashflows.length-1]-= (transferOrStampRegCharges);
            isExtraChargeAndPossessionConsiderForYearly=true;
          }
        }

        monthsPassed++;
        currentDate.add(1, 'month');
      }

    if (yearlyEmiSum > 0  || yearlyBuilderAmt> 0) {
        cashflows.push(-(yearlyEmiSum+ yearlyBuilderAmt));
    }        

    if (cashflows[cashflows.length - 1] != 0) {            
        cashflows[cashflows.length - 1] += (finalPrice - loanAmount);
    } else {
        cashflows[cashflows.length - 2] += (finalPrice - loanAmount);  
        cashflows.pop();
    }
    cashflows[0]-=(bookingAmount);
  
    if(!isExtraChargeAndPossessionConsiderForYearly){
      cashflows[cashflows.length-1]-= (transferOrStampRegCharges);
      isExtraChargeAndPossessionConsiderForYearly=true;
    }

    cashflows = cashflows.filter(val => !isNaN(val) && isFinite(val));
    const monthly_cashflow= table.map((tab)=>tab[8]);
    let irrForMonthlyCashflow = calculateIRRMonthly(monthly_cashflow);

    if(irrForMonthlyCashflow===Infinity || irrForMonthlyCashflow===0 || irrForMonthlyCashflow === "NUM!")
      irrForMonthlyCashflow= null; 
    
   let totalIntrest = table.reduce((sum, currentArray) => {return sum + parseFloat(currentArray[4]);},0);
   let totalPrinciple = table.reduce((sum, currentArray) => {return sum + parseFloat(currentArray[5]);},0);
   let totalInvestment = parseInt(bookingAmount + totalIntrest + totalPrinciple); 
    
    if(holdingPeriod> handoverPeriod){
      totalInvestment+= transferOrStampRegCharges;
    }

    const totalReturns = finalPrice - acquisitionPrice - totalIntrest - transferOrStampRegCharges;

    return {
          xirr:parseFloat((irrForMonthlyCashflow * 100).toFixed(2)),
          cashflows_yearly: cashflows,
          booking_amount: bookingAmount,
          possession_amount:possessionAmount,
          charges_value: transferOrStampRegCharges,
          amount_not_disbursed: Math.max(0,remainingLoanAmount - amtDisbursed), 
          total_investment: totalInvestment,
          total_returns : totalReturns,
          loan_balance: Math.ceil(loanAmount),
          cagr:cagr,
          constructionCompletionDate:constructionDate.format("YYYY-MM-DD"),
          equity_multiplier: parseFloat(((totalInvestment + totalReturns) / totalInvestment).toFixed(2)),
          monthly_cf: table
    };
} catch (error) {
    return { error: error.toString() };
}
}

export default function PropertyInvestmentCalculator() {
  const [formData, setFormData] = useState({
    acquisitionPrice: '',
    tenure: '20',
    holdingPeriod: '4',
    constructionCompletionDate: '',
    finalPrice: '',
    interestRate: '8.5',
    loanPercentage: '85',
    selectedCharge: 'Stamp Duty',
    assetType: 'apartment'
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-adjust loan percentage based on asset type
    if (name === 'assetType') {
      const newLoanPercentage = value === 'plot' ? '75' : '85';
      setFormData(prev => ({
        ...prev,
        [name]: value,
        loanPercentage: newLoanPercentage
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = () => {
    setLoading(true);
    
    try {
      const data = {
        acquisitionPrice: parseFloat(formData.acquisitionPrice),
        tenure: parseInt(formData.tenure),
        holdingPeriod: parseInt(formData.holdingPeriod),
        constructionCompletionDate: formData.constructionCompletionDate,
        finalPrice: parseFloat(formData.finalPrice),
        interestRate: parseFloat(formData.interestRate),
        loanPercentage: parseFloat(formData.loanPercentage),
        selectedCharge: formData.selectedCharge,
        assetType: formData.assetType
      };

      const result = createReport(data);
      setResults(result);
    } catch (error) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Property Investment Calculator
          </h1>
          <p>Calculate returns, cash flows, and investment metrics for your property</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-gray-50 p-6 rounded">
            <h2 className="text-xl font-bold mb-4">Investment Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Acquisition Price (₹)</label>
                <input
                  type="number"
                  name="acquisitionPrice"
                  value={formData.acquisitionPrice}
                  onChange={handleInputChange}
                  className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 5000000"
                />
              </div>

              <div>
                <label className="block mb-1">Expected Selling Price (₹)</label>
                <input
                  type="number"
                  name="finalPrice"
                  value={formData.finalPrice}
                  onChange={handleInputChange}
                    className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 8000000"
                />
              </div>

              <div>
                <label className="block mb-1">Loan Tenure (Years)</label>
                <input
                  type="number"
                  name="tenure"
                  value={formData.tenure}
                  onChange={handleInputChange}
                   className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 20"
                />
              </div>

              <div>
                <label className="block mb-1">Holding Period (Years)</label>
                <input
                  type="number"
                  name="holdingPeriod"
                  value={formData.holdingPeriod}
                  onChange={handleInputChange}
                   className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 5"
                />
              </div>

              <div>
                <label className="block mb-1">Interest Rate (% per annum)</label>
                <input
                  type="number"
                  step="0.1"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleInputChange}
                   className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 8.5"
                />
              </div>

              <div>
                <label className="block mb-1">Loan Percentage (%)</label>
                <input
                  type="number"
                  name="loanPercentage"
                  value={formData.loanPercentage}
                  onChange={handleInputChange}
                    className="w-full p-2 bg-white border border-gray-300 rounded"
                  placeholder="e.g., 80"
                />
              </div>

              <div>
                <label className="block mb-1">Construction Completion Date</label>
                <input
                  type="date"
                  name="constructionCompletionDate"
                  value={formData.constructionCompletionDate}
                  onChange={handleInputChange}
                   className="w-full p-2 bg-white border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block mb-1">Asset Type</label>
                <select
                  name="assetType"
                  value={formData.assetType}
                  onChange={handleInputChange}
                    className="w-full p-2 bg-white border border-gray-300 rounded"
                >
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="plot">Plot</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block mb-1">Selected Charge</label>
                <select
                  name="selectedCharge"
                  value={formData.selectedCharge}
                  onChange={handleInputChange}
                    className="w-full p-2 bg-white border border-gray-300 rounded"
                >
                  <option value="Stamp Duty">Stamp Duty</option>
                  <option value="Transfer Fees">Transfer Fees</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-black text-white rounded cursor-pointer p-3 mt-4"
            >
              {loading ? 'Calculating...' : 'Calculate Investment Returns'}
            </button>
          </div>

          {/* Results */}
          <div className="border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold mb-4">Investment Analysis</h2>

            {results && !results.error && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border border-gray-300 rounded bg-gray-200 p-3">
                    <div className="text-sm">XIRR (Monthly)</div>
                    <div className="text-xl font-bold">
                      {results.xirr ? `${results.xirr.toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>
                  
                      <div className="border border-gray-300 rounded bg-gray-200 p-3">
                    <div className="text-sm">CAGR</div>
                    <div className="text-xl font-bold">
                      {(results.cagr * 100).toFixed(2)}%
                    </div>
                  </div>

                     <div className="border border-gray-300 rounded bg-gray-200 p-3">
                    <div className="text-sm">Equity Multiplier</div>
                    <div className="text-xl font-bold">
                      {results.equity_multiplier}x
                    </div>
                  </div>

                      <div className="border border-gray-300 rounded bg-gray-200 p-3">
                    <div className="text-sm">Total Returns</div>
                    <div className="text-xl font-bold">
                      {formatCost(results.total_returns)}
                    </div>
                  </div>
                </div>

                <div className="space-y-8 mb-4">
                  <div className="flex justify-between border-b pb-1">
                    <span className='font-bold'>Total Investment</span>
                    <span>{formatCost(results.total_investment)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                       <span className='font-bold'>Booking Amount</span>
                    <span>{formatCost(results.booking_amount)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                        <span className='font-bold'>Possession Amount</span>
                    <span>{formatCost(results.possession_amount)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                        <span className='font-bold'>Registration Charges</span>
                    <span>{formatCost(results.charges_value)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                       <span className='font-bold'>Final Loan Balance</span>
                    <span>{formatCost(results.loan_balance)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowMonthlyTable(!showMonthlyTable)}
                  className="w-full bg-green-200 cursor-pointer rounded p-2"
                >
                  {showMonthlyTable ? 'Hide' : 'Show'} Monthly Cash Flow Table
                </button>
              </div>
            )}

            {results && results.error && (
              <div className="bg-red-300 rounded p-4">
                <div className="font-bold">Error</div>
                <div className="text-sm">{results.error}</div>
              </div>
            )}

            {!results && (
              <div className="bg-blue-50 rounded text-center p-8">
                <p>Enter your investment details to see the analysis</p>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Cash Flow Table */}
        {results && !results.error && showMonthlyTable && (
          <div className="mt-8 border p-4">
            <h3 className="text-lg font-bold mb-4">Monthly Cash Flow Analysis</h3>
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Month</th>
                    <th className="border p-2 text-right">Opening Loan</th>
                    <th className="border p-2 text-right">Other Cash Flow</th>
                    <th className="border p-2 text-right">EMI</th>
                    <th className="border p-2 text-right">Interest</th>
                    <th className="border p-2 text-right">Principal</th>
                    <th className="border p-2 text-right">Closing Loan</th>
                    <th className="border p-2 text-right">Builder Amount</th>
                    <th className="border p-2 text-right">Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {results.monthly_cf.map((row, index) => (
                    <tr key={index}>
                      <td className="border p-2">{row[0]}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[1]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[2].value))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[3]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[4]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[5]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[6]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[7]))}</td>
                      <td className="border p-2 text-right">{formatCost(parseFloat(row[8]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
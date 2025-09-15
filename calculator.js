import moment from 'moment'
import { formatForInvestmentReport } from './helpers/dateTime.js'

function formatCost(price) {
    if (price === undefined || price === null) return

    let isNegative = false
    if (price < 0) {
        isNegative = true
        price = Math.abs(price)
    }

    const priceStr = price.toString().replace(/,/g, '')
    const [integerPart, decimalPart] = priceStr.split('.')

    let lastThree = integerPart.slice(-3)
    let otherNumbers = integerPart.slice(0, -3)

    if (otherNumbers) {
        lastThree = ',' + lastThree
    }

    otherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')

    let formattedPrice = `₹${otherNumbers}${lastThree}`
    if (decimalPart) {
        formattedPrice += `.${decimalPart}`
    }

    if (isNegative) formattedPrice = `-${formattedPrice}`

    return formattedPrice
}

function calculateLoanDisbursement(quarters, totalLoanAmount, assetType) {
    if (!Array.isArray(quarters) || !totalLoanAmount || !assetType) {
        throw new Error('Invalid input for calculateLoanDisbursement.')
    }

    const numQuarters = quarters.length
    let disbursement = []

    const apartmentDistributions = {
        4: [0.4, 0.3, 0.15, 0.15],
        3: [0.7, 0.15, 0.15],
        2: [0.85, 0.15],
        1: [1.0],
    }

    // const plotDistributions = {
    //     2: [0.5, 0.5],
    //     1: [1.0],
    // };

    if (assetType === 'plot') {
        if (numQuarters <= 4) {
            const share = totalLoanAmount / numQuarters
            disbursement = Array(numQuarters).fill(+share.toFixed(2))
        } else {
            const firstHalf = totalLoanAmount * 0.5
            const secondHalf = totalLoanAmount * 0.5
            const firstQuarterShare = firstHalf / 4
            const remainingQuarterShare = secondHalf / (numQuarters - 4)

            for (let i = 0; i < 4; i++) {
                disbursement.push(+firstQuarterShare.toFixed(2))
            }
            for (let i = 4; i < numQuarters; i++) {
                disbursement.push(+remainingQuarterShare.toFixed(2))
            }
        }
    } else if (assetType === 'apartment' || assetType === 'villa') {
        const distributions = apartmentDistributions
        let percentages

        if (numQuarters >= 13) {
            percentages = distributions[4]
        } else if (numQuarters >= 9) {
            percentages = distributions[3]
        } else if (numQuarters >= 5) {
            percentages = distributions[2]
        } else {
            percentages = distributions[1]
        }

        const years = percentages.length
        const quartersPerYear = Math.floor(numQuarters / years)
        const remainderQuarters = numQuarters % years

        percentages.forEach((percentage, i) => {
            const totalQuarters = i < years - 1 ? quartersPerYear : quartersPerYear + remainderQuarters
            for (let j = 0; j < totalQuarters; j++) {
                disbursement.push(+(totalLoanAmount * (percentage / totalQuarters)).toFixed(2))
            }
        })
    } else {
        throw new Error("Invalid assetType. Use 'plot', 'apartment', or 'villa'.")
    }

    return disbursement
}

function calculateIRRMonthly(values, initialGuess = 0.05) {
    const irrResult = (values, rate) => {
        const r = rate + 1
        let result = values[0]
        for (let i = 1; i < values.length; i++) {
            const timeFraction = i / 12
            result += values[i] / Math.pow(r, timeFraction)
        }
        return result
    }

    const irrResultDeriv = (values, rate) => {
        const r = rate + 1
        let result = 0
        for (let i = 1; i < values.length; i++) {
            const timeFraction = i / 12
            result -= (timeFraction * values[i]) / Math.pow(r, timeFraction + 1)
        }
        return result
    }

    const hasPositive = values.some((v) => v > 0)
    const hasNegative = values.some((v) => v < 0)
    if (!hasPositive || !hasNegative) return '#NUM!'

    const guess = initialGuess
    const epsMax = 1e-8
    const iterMax = 100

    let resultRate = guess
    for (let iteration = 0; iteration < iterMax; iteration++) {
        const resultValue = irrResult(values, resultRate)
        const derivValue = irrResultDeriv(values, resultRate)

        if (Math.abs(derivValue) < epsMax) break

        const newRate = resultRate - resultValue / derivValue
        if (Math.abs(newRate - resultRate) < epsMax) return newRate

        resultRate = newRate
    }

    return '#NUM!'
}

function getMinimumArea(property) {
    const { assetType, configuration } = property

    switch (assetType) {
        case 'apartment':
            return getMinimumApartmentArea(configuration)

        case 'villa':
            return getMinimumVillaArea(configuration)

        case 'plot':
            return getMinimumPlotArea(configuration)

        default:
            return null
    }
}

/**
 * Gets minimum area from apartment configurations
 */
function getMinimumApartmentArea(config) {
    if (!config) return null
    const allConfigs = [
        ...(config.studio ?? []),
        ...(config.oneBHK ?? []),
        ...(config.oneBHKPlus ?? []),
        ...(config.twoBHK ?? []),
        ...(config.twoBHKPlus ?? []),
        ...(config.threeBHK ?? []),
        ...(config.threeBHKPlus ?? []),
        ...(config.fourBHK ?? []),
        ...(config.fourBHKPlus ?? []),
        ...(config.fiveBHK ?? []),
        ...(config.fiveBHKPlus ?? []),
        ...(config.sixBHK ?? []),
    ]

    // Filter available units and get minimum carpet area
    const availableAreas = allConfigs
        .filter((unit) => unit.available)
        .map((unit) => unit.sbua)
        .filter((area) => area > 0)

    return availableAreas.length > 0 ? Math.min(...availableAreas) : null
}

/**
 * Gets minimum area from villa configurations
 */
function getMinimumVillaArea(config) {
    if (!config || config.length === 0) return null

    const areas = config
        .map((villa) => {
            if (villa.landholdingType === 'uds') {
                return villa.plotArea
            } else {
                return villa.landDetails.sbua
            }
        })
        .filter((area) => area > 0)

    return areas.length > 0 ? Math.min(...areas) : null
}

/**
 * Gets minimum area from plot configurations
 */
function getMinimumPlotArea(config) {
    if (!config || config.length === 0) return null

    const areas = config.map((plot) => plot.plotArea).filter((area) => area > 0)

    return areas.length > 0 ? Math.min(...areas) : null
}

// Alternative function that also considers the property's sbua field
function getMinimumAreaWithSbua(property) {
    const configMinArea = getMinimumArea(property)
    const sbuaArea = property.sbua

    if (configMinArea && sbuaArea) {
        return Math.min(configMinArea, sbuaArea)
    }

    return configMinArea || sbuaArea || null
}

/**
 * Universal function to get minimum area from any property type
 * Automatically determines the asset type and calls the appropriate function
 * @param property - The property object of any asset type
 * @returns The minimum area in square feet, or null if no area is found
 */
function getPropertyMinimumArea(property) {
    switch (property.assetType) {
        case 'apartment':
            return getMinimumApartmentArea(property.configuration)

        case 'villa':
            return getMinimumVillaArea(property.configuration)

        case 'plot':
            return getMinimumPlotArea(property.configuration)

        default:
            console.warn(`Unknown asset type: ${property.assetType}`)
            return null
    }
}
function calculateGrowth(cagr) {
    if (cagr === undefined || cagr === null) return null
    if (cagr >= 9) return 'High'
    if (cagr > 4 && cagr < 9) return 'Medium'
    if (cagr <= 4) return 'Low'
    return null
}
function calculateEstSellingPrice(localProperty, years = 4) {
    const area = getPropertyMinimumArea(localProperty) || 0
    const basePrice =
        localProperty?.projectOverview?.pricePerSqft && area
            ? localProperty.projectOverview.pricePerSqft * area || 0
            : 0
    if (localProperty.investmentOverview.cagr === undefined || localProperty.investmentOverview.cagr === null)
        return basePrice
    return basePrice * Math.pow(1 + localProperty.investmentOverview.cagr / 100, years)
}

function calculateReport(data) {
    try {
        const {
            acquisitionPrice,
            tenure,
            holdingPeriod,
            constructionCompletionDate: inputCompletionDate,
            finalPrice,
            interestRate,
            loanPercentage,
            assetType,
        } = data
        const constructionCompletionDate =
            typeof inputCompletionDate === 'string'
                ? parseInt(inputCompletionDate, 10) || 1798695610
                : inputCompletionDate || 1798695610

        // current date
        const bookingDate = moment()

        // handover date
        let constructionDate = moment(formatForInvestmentReport(constructionCompletionDate), 'YYYY-MM-DD')

        // we will start disbursing loan amount 3 months after the current date
        const quarterDate = moment(bookingDate).add(3, 'months')

        // if the construction date is before the quarter date then move construction date 1 year forward
        if (constructionDate.isBefore(quarterDate)) {
            constructionDate = quarterDate.clone().add(1, 'year')
        }

        const monthlyInterestRate = interestRate / 12 / 100

        // booking amount will be 10 %
        const bookingAmount = 0.1 * acquisitionPrice

        // possession amount will be 5 % or less than 5 %
        const possessionPercent = Math.min(5, 90 - loanPercentage)
        const possessionAmount = (possessionPercent / 100) * acquisitionPrice

        const handoverPeriod = constructionDate.year() - bookingDate.year()

        // to check
        // if the handover period is more than or equal to holding period then transfer fees (2%) otherwise stamp duty and registration charges (6.5%) will be applied
        const transferOrStampRegCharges =
            handoverPeriod >= holdingPeriod
                ? parseFloat((acquisitionPrice * 0.02).toString())
                : parseFloat((acquisitionPrice * 0.065).toString())

        // variable for  tracking which charge is applied
        const transferOrStamp = handoverPeriod >= holdingPeriod ? 0 : 1

        // loan amount
        const remainingLoanAmount = (loanPercentage / 100) * acquisitionPrice // change

        // if the loan percentage is less than 85 percentrage then (85 - loan percentage) percentage amount will be paid to builder
        const AmountToBuilderPer = Math.max(0, 85 - loanPercentage)
        const AmountToBuilder = (AmountToBuilderPer / 100) * acquisitionPrice

        // cagr
        // let cagr = Math.pow(finalPrice / acquisitionPrice, 1 / holdingPeriod) - 1;

        //  getting all quarters on which the loan amount will be disursed
        const quarters = []
        while (quarterDate.isBefore(constructionDate)) {
            quarters.push(quarterDate.clone())
            quarterDate.add(3, 'months')
        }

        let maxQuartersLength

        // for apartment, etc max holding period is 4 years
        if (assetType === 'apartment') maxQuartersLength = Math.min(16, quarters.length)
        else if (assetType === 'plot') maxQuartersLength = Math.min(8, quarters.length)
        else maxQuartersLength = quarters.length

        // if quarters length is more than  the maxQuarters length then remove some quarters
        while (quarters.length > maxQuartersLength) quarters.pop()

        //  getting all disbursement on all quarters
        const disbursment = calculateLoanDisbursement(quarters, remainingLoanAmount, assetType)

        let loanAmount = 0

        // monthy cashflow table
        const table = []

        // yearly cashlows
        let cashflows = []

        // variable for yearly emi sum
        let yearlyEmiSum = 0

        const currentDate = moment(bookingDate)

        // montly emis and cashlflow will be calculated for minimum of total tenure and holding period
        const totalMonths = tenure * 12
        const totalHoldingMonths = holdingPeriod * 12

        let monthsPassed = 0

        // variable for tracking loan amount disbursed till current date
        let amtDisbursed = 0

        // variable for tracking amount paid to builder yearly
        let yearlyBuilderAmt = 0

        // variable for tracking extra charges for monthly cashflow and yearly cashflow
        let isExtraChargeAndPossessionConsiderForYearly = false
        let isExtraChargeAndPossessionConsiderForMonthly = false

        let currentQuarter = 0

        for (let i = 0; i < Math.min(totalMonths, totalHoldingMonths); i++) {
            // change
            const isQuarter = quarters.some((quarter) => quarter.isSame(currentDate, 'month'))
            if (isQuarter) {
                loanAmount += disbursment[currentQuarter]
                amtDisbursed += disbursment[currentQuarter]
                currentQuarter++
            }

            let monthlyBuilderAmt = 0 // includes intial amount to builder (85- loan percentage (if less than 85)), possession amount, and loan amount not disbursed at last

            const openingLoanAmount = loanAmount
            const interest = loanAmount * monthlyInterestRate
            const emi =
                (loanAmount * monthlyInterestRate) /
                (1 - Math.pow(1 + monthlyInterestRate, -(tenure * 12 - monthsPassed))) // change
            const principal = emi - interest
            const closingLoanAmount = loanAmount - emi + interest

            let finalMonthlyCashflow = emi ? -emi : 0 // includes all cashflow (inflow and outflow): booking amt, possession amt, extra charges, loan repayment at sale, amt not disbursed till last and amount of sale
            let monthlyOthersCashFlow = 0 // includes all cashflow except emi: booking amt, possession amt, extra charges, loan repayment at sale, amt not disbursed till last and amount of sale
            const monthlyOthersCashFlowComponents = [] // includes the components of cashflow

            // on booking date
            if (currentDate.month() === bookingDate.month() && currentDate.year() === bookingDate.year()) {
                finalMonthlyCashflow -= bookingAmount
                monthlyOthersCashFlow += bookingAmount
                monthlyOthersCashFlowComponents.push(
                    `down payment (-${formatCost(parseInt(bookingAmount.toString()))})`,
                )
                if (AmountToBuilder) {
                    finalMonthlyCashflow -= AmountToBuilder

                    monthlyBuilderAmt += AmountToBuilder
                    yearlyBuilderAmt += AmountToBuilder

                    monthlyOthersCashFlow += AmountToBuilder
                    monthlyOthersCashFlowComponents.push(
                        `builder's remaining amount (-${formatCost(parseInt(AmountToBuilder.toString()))})`,
                    )
                }
            }

            // on handoverMonth possessionAmount and extra charges will be paid
            if (currentDate.month() === constructionDate.month() && currentDate.year() === constructionDate.year()) {
                finalMonthlyCashflow -= possessionAmount + transferOrStampRegCharges
                monthlyOthersCashFlow += possessionAmount + transferOrStampRegCharges
                monthlyOthersCashFlowComponents.push(
                    `possession amount (-${formatCost(parseInt(possessionAmount.toString()))})`,
                )

                if (transferOrStamp === 1)
                    monthlyOthersCashFlowComponents.push(
                        `stamp duty & registraion charges (-${formatCost(parseInt(transferOrStampRegCharges.toString()))})`,
                    )
                else
                    monthlyOthersCashFlowComponents.push(
                        `transfer fees (-${formatCost(parseInt(transferOrStampRegCharges.toString()))})`,
                    )

                isExtraChargeAndPossessionConsiderForMonthly = true

                // only possessionAmount will be paid to builder. extra charges (transferOrStampRegCharges) will be paid to goverment
                monthlyBuilderAmt += possessionAmount
                yearlyBuilderAmt += possessionAmount
            }

            // if handover month is after the holding period then possessionAmount and extra charges will be paid on last month
            if (!isExtraChargeAndPossessionConsiderForMonthly && i === Math.min(totalMonths, totalHoldingMonths) - 1) {
                finalMonthlyCashflow -= possessionAmount + transferOrStampRegCharges
                monthlyOthersCashFlow += possessionAmount + transferOrStampRegCharges
                monthlyOthersCashFlowComponents.push(
                    `possession amount (-${formatCost(parseInt(possessionAmount.toString()))})`,
                )

                if (transferOrStamp === 1)
                    monthlyOthersCashFlowComponents.push(
                        `stamp duty & registraion charges (-${formatCost(parseInt(transferOrStampRegCharges.toString()))})`,
                    )
                else
                    monthlyOthersCashFlowComponents.push(
                        `transfer fees (-${formatCost(parseInt(transferOrStampRegCharges.toString()))})`,
                    )

                isExtraChargeAndPossessionConsiderForMonthly = true

                monthlyBuilderAmt += possessionAmount
                yearlyBuilderAmt += possessionAmount
            }

            // on last month we will balance selling price (price of sale), remaining loan amount to be paid (disbursed) and loan amount that is not disbursed till last
            if (i === Math.min(totalMonths, totalHoldingMonths) - 1) {
                // selling price
                finalMonthlyCashflow += finalPrice

                // remaining loan amount to be paid at last
                finalMonthlyCashflow -= closingLoanAmount

                // loan amount not disbursed till last
                finalMonthlyCashflow -= parseInt((remainingLoanAmount - amtDisbursed).toString())

                monthlyOthersCashFlow -= finalPrice
                monthlyOthersCashFlow += closingLoanAmount
                monthlyOthersCashFlow += parseInt((remainingLoanAmount - amtDisbursed).toString())

                monthlyOthersCashFlowComponents.push(`selling price (+${formatCost(parseInt(finalPrice.toString()))})`)
                monthlyOthersCashFlowComponents.push(
                    `loan repayment at sale (-${formatCost(parseInt(closingLoanAmount.toString()))})`,
                )

                if (parseInt((remainingLoanAmount - amtDisbursed).toString()))
                    monthlyOthersCashFlowComponents.push(
                        `remaining loan disbursed amount (-${formatCost(parseInt((remainingLoanAmount - amtDisbursed).toString()))})`,
                    )

                monthlyBuilderAmt += parseInt((remainingLoanAmount - amtDisbursed).toString())
                yearlyBuilderAmt += parseInt((remainingLoanAmount - amtDisbursed).toString())
            }

            table.push([
                currentDate.format('MMMM YYYY'),
                openingLoanAmount.toFixed(2),
                { value: monthlyOthersCashFlow.toFixed(2), components: monthlyOthersCashFlowComponents },
                emi.toFixed(2),
                interest.toFixed(2),
                principal.toFixed(2),
                closingLoanAmount.toFixed(2),
                monthlyBuilderAmt.toFixed(2),
                finalMonthlyCashflow,
            ])

            loanAmount = closingLoanAmount
            yearlyEmiSum += emi

            // Check if we need to record the yearly EMI sum
            if (currentDate.month() === 11) {
                // December
                cashflows.push(-(yearlyEmiSum + yearlyBuilderAmt))
                yearlyEmiSum = 0
                yearlyBuilderAmt = 0

                // check if possessionAmount and extra charges are not included in cashflow table
                if (!isExtraChargeAndPossessionConsiderForYearly && currentDate.year() === constructionDate.year()) {
                    cashflows[cashflows.length - 1] -= transferOrStampRegCharges
                    isExtraChargeAndPossessionConsiderForYearly = true
                }
            }

            monthsPassed++
            currentDate.add(1, 'month')
        }

        if (yearlyEmiSum > 0 || yearlyBuilderAmt > 0) {
            cashflows.push(-(yearlyEmiSum + yearlyBuilderAmt))
        }

        if (cashflows[cashflows.length - 1] != 0) {
            cashflows[cashflows.length - 1] += finalPrice - loanAmount
        } else {
            cashflows[cashflows.length - 2] += finalPrice - loanAmount
            cashflows.pop()
        }
        cashflows[0] -= bookingAmount

        if (!isExtraChargeAndPossessionConsiderForYearly) {
            cashflows[cashflows.length - 1] -= transferOrStampRegCharges
            isExtraChargeAndPossessionConsiderForYearly = true
        }

        cashflows = cashflows.filter((val) => !isNaN(val) && isFinite(val))

        // irr for yearly cashflow
        // let irr = IRR(cashflows);

        // if(irr===Infinity || irr===0)
        // irr = irrBisection(cashflows);

        // if (irr === '#NUM') throw new Error("At least one positive and one negative cashflow required");

        const monthly_cashflow = table.map((tab) => tab[8])
        const monthly_cashflow_numbers = monthly_cashflow.map((cashflow) =>
            typeof cashflow === 'number' ? cashflow : 0,
        )

        // irr for monthly cashflow table
        let irrForMonthlyCashflow = calculateIRRMonthly(monthly_cashflow_numbers)

        if (irrForMonthlyCashflow === Infinity || irrForMonthlyCashflow === 0 || irrForMonthlyCashflow === 'NUM!')
            irrForMonthlyCashflow = null

        const totalIntrest = table.reduce((sum, currentArray) => {
            return sum + parseFloat(String(currentArray[4]))
        }, 0)
        const totalPrinciple = table.reduce((sum, currentArray) => {
            return sum + parseFloat(String(currentArray[5]))
        }, 0)
        let totalInvestment = bookingAmount + totalIntrest + totalPrinciple

        // only stamp duty and registration charges will be included in total investment
        if (holdingPeriod > handoverPeriod) {
            totalInvestment += transferOrStampRegCharges
        }

        const totalReturns = finalPrice - acquisitionPrice - totalIntrest - transferOrStampRegCharges //change

        return {
            // irr: parseFloat((irr * 100).toFixed(2)),
            xirr:
                irrForMonthlyCashflow !== null && typeof irrForMonthlyCashflow === 'number'
                    ? parseFloat(String((irrForMonthlyCashflow * 100).toFixed(2)))
                    : null,
            cashflows_yearly: cashflows,
            // booking_amount: bookingAmount,
            // possession_amount:possessionAmount,
            // charges_value: transferOrStampRegCharges,
            // amount_not_disbursed: Math.max(0,remainingLoanAmount - amtDisbursed),
            minInvestment: totalInvestment,
            total_returns: totalReturns,
            // loan_balance: Math.ceil(loanAmount),
            // cagr:cagr,
            // constructionCompletionDate:constructionDate.format("YYYY-MM-DD"),
            equity_multiplier: parseFloat(((totalInvestment + totalReturns) / totalInvestment).toFixed(2)),
            monthly_cf: table
        }
    } catch (error) {
        return { error: error.toString() }
    }
}

export {
    formatCost,
    calculateLoanDisbursement,
    calculateIRRMonthly,
    getMinimumArea,
    getMinimumAreaWithSbua,
    getPropertyMinimumArea,
    calculateGrowth,
    calculateEstSellingPrice,
    calculateReport,
    calculateReport as calculatePropertyInvestment
}

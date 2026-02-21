const INR_TO_CREDIT_RATE = 1; // 1 INR = 1 Credit
const USD_TO_INR_RATE = 85; // 1 USD ≈ 85 INR
const HIDDEN_PROFIT_PER_MINUTE_INR = 5; // ₹5 profit per minute (Phone calls + Browser voice)

function inrToCredits(inr) {
    return parseFloat((inr * INR_TO_CREDIT_RATE).toFixed(4));
}


function usdToCredits(usdCost) {
    const inrCost = usdCost * USD_TO_INR_RATE;
    return inrToCredits(inrCost);
}

function getProfitMarkupPerMinute() {
    return inrToCredits(HIDDEN_PROFIT_PER_MINUTE_INR);
}

const MIN_CREDITS_FOR_CALL = inrToCredits(10);

module.exports = {
    INR_TO_CREDIT_RATE,
    USD_TO_INR_RATE,
    inrToCredits,
    usdToCredits,
    getProfitMarkupPerMinute,
    MIN_CREDITS_FOR_CALL,
};

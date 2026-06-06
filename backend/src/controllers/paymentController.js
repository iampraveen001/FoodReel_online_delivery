const { success, error } = require("../utils/response");
const crypto = require("crypto");

const MOCK_RAZORPAY_KEY = "rzp_test_mocked_key_" + crypto.randomBytes(4).toString("hex");

// POST /api/payment/create-order
const createOrder = async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    
    // Simulating Razorpay's instance.orders.create()
    const mockedOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    
    const orderDetails = {
      id: mockedOrderId,
      entity: "order",
      amount: amount * 100, // Razorpay works in subunits (paise)
      amount_paid: 0,
      amount_due: amount * 100,
      currency: "INR",
      receipt: receipt || "receipt_1234",
      status: "created",
      attempts: 0,
      created_at: Math.floor(Date.now() / 1000)
    };

    // Include simulated key_id for frontend to use in its mock widget
    return success(res, { order: orderDetails, key_id: MOCK_RAZORPAY_KEY }, "Mock Razorpay Order Generated", 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Simulate strict signature validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return error(res, "Missing Razorpay Cryptographic Signatures", 400);
    }
    
    // Pretend verification succeeds
    return success(res, { verified: true }, "Mock Payment Signature Verified! Transaction Successful.");
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { createOrder, verifyPayment };

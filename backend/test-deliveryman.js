// Test script to demonstrate nearest deliveryman assignment
require("dotenv").config();
const connectDB = require('./src/config/db');
const { findNearestDeliveryman } = require('./src/utils/location');

async function testNearestDeliveryman() {
  console.log('🧪 Testing Nearest Deliveryman Assignment...\n');

  // Connect to database
  try {
    await connectDB();
    console.log('✅ Database connected\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }

  // Test coordinates (Prayagraj, UP area)
  const testLat = 25.4358;
  const testLng = 81.8463;

  console.log(`📍 Target Location: ${testLat}, ${testLng} (Prayagraj, UP)`);
  console.log('🔍 Searching for nearest available deliveryman within 10km...\n');

  try {
    const nearestDeliveryman = await findNearestDeliveryman(testLat, testLng, 10);

    if (nearestDeliveryman) {
      console.log('✅ Found nearest deliveryman!');
      console.log(`👤 Name: ${nearestDeliveryman.name}`);
      console.log(`📞 Phone: ${nearestDeliveryman.phone}`);
      console.log(`📏 Distance: ${nearestDeliveryman.distance} km`);
      console.log(`🚗 Vehicle: ${nearestDeliveryman.deliveryInfo.vehicleType} (${nearestDeliveryman.deliveryInfo.vehicleNumber})`);
      console.log(`⭐ Rating: ${nearestDeliveryman.deliveryInfo.rating}`);
    } else {
      console.log('❌ No available deliverymen found within 10km radius');
      console.log('💡 Make sure deliverymen are registered and set as available with location data');
    }
  } catch (error) {
    console.error('❌ Error testing deliveryman assignment:', error.message);
  }

  process.exit(0);
}

// Run the test
testNearestDeliveryman();
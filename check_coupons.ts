import { supabaseService } from './src/services/supabaseService';

async function check() {
  try {
    const coupons = await supabaseService.getCoupons('demo-restaurant-id');
    console.log('Current Coupons:', coupons);
  } catch (e) {
    console.error('Error:', e);
  }
}

check();

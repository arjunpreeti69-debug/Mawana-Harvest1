const SUPABASE_URL = 'https://nsdckldrxwgdfoehgdad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZGNrbGRyeHdnZGZvZWhnZGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDg1NjIsImV4cCI6MjA5MzM4NDU2Mn0.GVWPLhBhAkb-YZUg-rDjmBu0qMJauiYjU4Llz5FEydo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Products API
async function getProducts() {
    const { data, error } = await supabaseClient.from('products').select('*').order('id', { ascending: true });
    if (error) {
        console.error('Error fetching products:', error);
        throw new Error(error.message || JSON.stringify(error));
    }
    return data;
}

async function updateProduct(id, updates) {
    const { error } = await supabaseClient.from('products').update(updates).eq('id', id);
    if (error) console.error('Error updating product:', error);
}

async function addProduct(product) {
    const { error } = await supabaseClient.from('products').insert([product]);
    if (error) console.error('Error adding product:', error);
}

// Orders API
async function getOrders() {
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data;
}

async function addOrder(orderData) {
    // Insert order
    const { data: newOrder, error } = await supabaseClient.from('orders').insert([{
        customer_name: orderData.customer_name,
        phone: orderData.phone,
        address: orderData.address,
        items: orderData.items,
        total: orderData.total,
        status: 'Pending',
        payment_status: 'Pending'
    }]).select();
    
    if (error) {
        console.error('Error adding order:', error);
        return null;
    }
    
    // Update product quantities
    for (const item of orderData.items) {
        const { data: productData } = await supabaseClient.from('products').select('quantity').eq('id', item.id).single();
        if (productData) {
            const newQty = Math.max(0, productData.quantity - item.cartQuantity);
            await supabaseClient.from('products').update({ quantity: newQty }).eq('id', item.id);
        }
    }
    
    return newOrder ? newOrder[0] : null;
}

async function updateOrderStatus(id, status) {
    const { error } = await supabaseClient.from('orders').update({ status }).eq('id', id);
    if (error) console.error('Error updating order status:', error);
}

async function updateOrderPaymentStatus(id, status) {
    const { error } = await supabaseClient.from('orders').update({ payment_status: status }).eq('id', id);
    if (error) console.error('Error updating order payment status:', error);
}

// Settings API
async function getSettings() {
    const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
    if (error) {
        console.error('Error fetching settings:', error);
        return null;
    }
    return data;
}

async function updateSettings(updates) {
    const { error } = await supabaseClient.from('settings').update(updates).eq('id', 1);
    if (error) console.error('Error updating settings:', error);
}

// Storage API
async function uploadImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabaseClient.storage.from('images').upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error(uploadError.message);
    }

    const { data } = supabaseClient.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
}

window.db = {
    getProducts,
    updateProduct,
    addProduct,
    getOrders,
    addOrder,
    updateOrderStatus,
    updateOrderPaymentStatus,
    getSettings,
    updateSettings,
    uploadImage
};

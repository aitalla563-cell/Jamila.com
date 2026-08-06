// app.js
import { db, collection, addDoc, doc, onSnapshot, serverTimestamp } from "./firebase.js";

let currentConfig = {
    price: "0",
    title: "منتج جميلتي"
};

// 1. الاستماع لتحديثات إعدادات الصفحة تلقائياً من لوحة التحكم
onSnapshot(doc(db, "settings", "landing_page"), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        currentConfig = { ...currentConfig, ...data };

        // تحديث النصوص والأسعار في الواجهة
        if (data.title && document.getElementById('product-title')) {
            document.getElementById('product-title').innerText = data.title;
        }
        if (data.desc && document.getElementById('product-desc')) {
            document.getElementById('product-desc').innerText = data.desc;
        }
        if (data.price && document.getElementById('product-price')) {
            document.getElementById('product-price').innerText = data.price + ' د.م';
        }
        if (data.oldPrice && document.getElementById('product-oldprice')) {
            document.getElementById('product-oldprice').innerText = data.oldPrice + ' د.م';
        }

        // تحديث صورة المنتج
        if (data.images && data.images.length > 0 && document.getElementById('main-product-img')) {
            document.getElementById('main-product-img').src = data.images[0];
        }
    }
});

// 2. إرسال الطلب مباشرة إلى لوحة التحكم (Firestore)
document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    
    // تغيير حالة الزر لتفادي الضغط المتعدد
    submitBtn.innerText = "جاري إرسال الطلب...";
    submitBtn.disabled = true;

    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    const city = document.getElementById('client-city').value;

    const orderData = {
        name,
        phone,
        city,
        product: currentConfig.title,
        price: currentConfig.price,
        status: "قيد الانتظار",
        createdAt: serverTimestamp()
    };

    try {
        // حفظ الطلب مباشرة في Firestore لتظهر في admin.html
        await addDoc(collection(db, "orders"), orderData);

        // إظهار رسالة تأكيد للزبون وتفريغ استمارة الطلب
        alert('شكراً لك! تم استلام طلبك بنجاح وستتصل بك مصلحة الزبناء قريباً لتأكيد الطلب.');
        document.getElementById('order-form').reset();
    } catch (err) {
        alert('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.');
        console.error("Order Error:", err);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

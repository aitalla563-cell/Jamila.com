// app.js
import { db, collection, addDoc, doc, onSnapshot, serverTimestamp } from "./firebase.js";

let currentConfig = {
    price: "0",
    title: "منتج جميلتي",
    images: []
};

let galleryImages = [];
let activeSlide = 0;
let pixelsInjected = false;
let galleryAutoplayTimer = null;

// إعدادات التصميم الافتراضية (يتم تعديلها من لوحة المبرمج dev.html)
let designConfig = {
    siteName: '',
    colors: {},
    fonts: {},
    gallery: { mode: 'fade', autoplay: false, interval: 4 }
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = $('footer-year');
    if (yearEl) yearEl.innerText = new Date().getFullYear();
});

// ============ 0. مزامنة إعدادات التصميم (ألوان / خطوط / اسم الموقع / وضع المعرض) ============
onSnapshot(doc(db, "settings", "site_design"), (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    designConfig = {
        siteName: data.siteName || '',
        colors: data.colors || {},
        fonts: data.fonts || {},
        gallery: { mode: 'fade', autoplay: false, interval: 4, ...(data.gallery || {}) }
    };
    applyDesign(designConfig);
    // إعادة رسم المعرض إذا تغيّر وضع العرض
    if (galleryImages.length > 0) renderGallery();
});

function applyDesign(cfg) {
    const root = document.documentElement.style;

    const colorMap = {
        bg: '--cream',
        card: '--card',
        text: '--ink',
        textSoft: '--ink-soft',
        primary: '--rose',
        primaryDark: '--rose-dark',
        accent: '--gold'
    };
    Object.entries(colorMap).forEach(([key, cssVar]) => {
        if (cfg.colors && cfg.colors[key]) root.setProperty(cssVar, cfg.colors[key]);
    });

    if (cfg.fonts && cfg.fonts.heading) root.setProperty('--font-heading', `'${cfg.fonts.heading}', serif`);
    if (cfg.fonts && cfg.fonts.body) root.setProperty('--font-body', `'${cfg.fonts.body}', 'Segoe UI', Tahoma, sans-serif`);

    if (cfg.siteName) {
        document.title = document.title.includes('|')
            ? document.title.replace(/^.*\|/, `${cfg.siteName} |`)
            : document.title;
        // إن وُجد عنصر بمعرّف site-name داخل الصفحة، يتم تحديث نصه تلقائياً
        const siteNameEl = $('site-name');
        if (siteNameEl) siteNameEl.innerText = cfg.siteName;
    }
}

// ============ 1. مزامنة إعدادات الصفحة مباشرة من لوحة التحكم ============
onSnapshot(doc(db, "settings", "landing_page"), (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    currentConfig = { ...currentConfig, ...data };

    if (data.title) {
        document.title = `${data.title} | ${designConfig.siteName || 'جميلتي'}`;
        setText('product-title', data.title);
    }
    if (data.desc) setText('product-desc', data.desc);

    const price = parseFloat(data.price) || 0;
    const oldPrice = parseFloat(data.oldPrice) || 0;

    setText('product-price', formatPrice(price));
    updateStickyPrice(price);

    const oldPriceEl = $('product-oldprice');
    const badge = $('discount-badge');
    if (oldPrice > price && price > 0) {
        if (oldPriceEl) oldPriceEl.innerText = formatPrice(oldPrice);
        if (badge) {
            const pct = Math.round((1 - price / oldPrice) * 100);
            $('discount-percent').innerText = pct;
            badge.hidden = false;
        }
    } else {
        if (oldPriceEl) oldPriceEl.innerText = '';
        if (badge) badge.hidden = true;
    }

    if (Array.isArray(data.images) && data.images.length > 0) {
        galleryImages = data.images;
        renderGallery();
    }

    injectPixels(data.pixels);
});

function setText(id, value) {
    const el = $(id);
    if (el) el.innerText = value;
}

function formatPrice(n) {
    return `${n} د.م`;
}

function updateStickyPrice(price) {
    const el = $('sticky-price-text');
    if (el) el.innerText = formatPrice(price);
}

// ============ 2. معرض الصور (يدعم 3 طرق عرض: تلاشي / انزلاق / تكبير تدريجي) ============
function renderGallery() {
    const box = document.querySelector('.img-box');
    const dotsWrap = $('gallery-dots');
    if (!box || galleryImages.length === 0) return;

    if (activeSlide >= galleryImages.length) activeSlide = 0;

    const mode = (designConfig.gallery && designConfig.gallery.mode) || 'fade';
    box.classList.remove('mode-fade', 'mode-slide', 'mode-zoom');
    box.classList.add(`mode-${mode}`);

    if (mode === 'slide') {
        renderSlideMode(box);
    } else {
        renderSingleImageMode(box, mode);
    }

    renderGalleryDots(dotsWrap);
    setupGalleryAutoplay();
}

function renderSingleImageMode(box, mode) {
    let img = box.querySelector('#main-product-img');
    if (!img) {
        box.innerHTML = '';
        img = document.createElement('img');
        img.id = 'main-product-img';
        img.alt = currentConfig.title || '';
        box.appendChild(img);
    }
    if (img.src === galleryImages[activeSlide]) return;

    if (mode === 'zoom' || mode === 'fade') {
        img.classList.add('fading');
        setTimeout(() => {
            img.src = galleryImages[activeSlide];
            img.classList.remove('fading');
        }, 180);
    } else {
        img.src = galleryImages[activeSlide];
    }
}

function renderSlideMode(box) {
    let track = box.querySelector('.gallery-track');
    if (!track) {
        box.innerHTML = '';
        track = document.createElement('div');
        track.className = 'gallery-track';
        galleryImages.forEach((url, i) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `${currentConfig.title || ''} ${i + 1}`;
            if (i === 0) img.id = 'main-product-img';
            track.appendChild(img);
        });
        box.appendChild(track);
    } else {
        // إعادة بناء الشريط إذا تغيّر عدد الصور
        const imgs = track.querySelectorAll('img');
        if (imgs.length !== galleryImages.length) {
            track.innerHTML = '';
            galleryImages.forEach((url, i) => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `${currentConfig.title || ''} ${i + 1}`;
                if (i === 0) img.id = 'main-product-img';
                track.appendChild(img);
            });
        }
    }
    track.style.transform = `translateX(-${activeSlide * 100}%)`;
}

function renderGalleryDots(dotsWrap) {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    if (galleryImages.length <= 1) return;

    galleryImages.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `صورة ${i + 1}`);
        if (i === activeSlide) dot.classList.add('active');
        dot.addEventListener('click', () => {
            activeSlide = i;
            renderGallery();
        });
        dotsWrap.appendChild(dot);
    });
}

function setupGalleryAutoplay() {
    if (galleryAutoplayTimer) {
        clearInterval(galleryAutoplayTimer);
        galleryAutoplayTimer = null;
    }
    const g = designConfig.gallery || {};
    if (!g.autoplay || galleryImages.length <= 1) return;

    const intervalMs = Math.max(1.5, Number(g.interval) || 4) * 1000;
    galleryAutoplayTimer = setInterval(() => {
        activeSlide = (activeSlide + 1) % galleryImages.length;
        renderGallery();
    }, intervalMs);
}

// دعم التمرير باللمس على الصورة
(function enableSwipe() {
    const box = document.querySelector('.img-box');
    if (!box) return;
    let startX = 0;
    box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
        const diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) < 40 || galleryImages.length <= 1) return;
        // RTL: سحب لليمين = التالي بصرياً بما أن الاتجاه معكوس
        activeSlide = diff < 0
            ? (activeSlide + 1) % galleryImages.length
            : (activeSlide - 1 + galleryImages.length) % galleryImages.length;
        renderGallery();
    }, { passive: true });
})();

// ============ 3. شريط الطلب الثابت ============
(function stickyCta() {
    const stickyBar = $('sticky-cta');
    const orderSection = $('order-section');
    if (!stickyBar || !orderSection || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
        stickyBar.classList.toggle('visible', !entry.isIntersecting);
    }, { threshold: 0.15 });

    observer.observe(orderSection);

    $('sticky-order-btn')?.addEventListener('click', () => {
        orderSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('client-name')?.focus();
    });
})();

// ============ 4. التحقق من صحة البيانات ============
function validateName(value) {
    if (value.trim().length < 3) return 'يرجى إدخال الاسم الكامل';
    return '';
}

function validatePhone(value) {
    const cleaned = value.replace(/[\s-]/g, '');
    const isValid = /^(0[5-7]\d{8}|(\+212|00212)[5-7]\d{8})$/.test(cleaned);
    if (!isValid) return 'رقم هاتف غير صحيح (مثال: 06XXXXXXXX)';
    return '';
}

function validateCity(value) {
    if (value.trim().length < 2) return 'يرجى إدخال المدينة';
    return '';
}

function showFieldError(inputId, errorId, message) {
    const input = $(inputId);
    const errorEl = $(errorId);
    if (errorEl) errorEl.innerText = message;
    if (input) input.classList.toggle('invalid', !!message);
    return !message;
}

['client-name', 'client-phone', 'client-city'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
        $(id).classList.remove('invalid');
        const errorId = 'error-' + id.split('-')[1];
        const errorEl = $(errorId);
        if (errorEl) errorEl.innerText = '';
    });
});

// ============ 5. إرسال الطلب ============
document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('client-name').value;
    const phone = $('client-phone').value;
    const city = $('client-city').value;

    const nameOk = showFieldError('client-name', 'error-name', validateName(name));
    const phoneOk = showFieldError('client-phone', 'error-phone', validatePhone(phone));
    const cityOk = showFieldError('client-city', 'error-city', validateCity(city));

    if (!nameOk || !phoneOk || !cityOk) {
        document.querySelector('.invalid')?.focus();
        return;
    }

    const submitBtn = $('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = $('btn-spinner');

    submitBtn.disabled = true;
    btnText.innerText = 'جاري إرسال الطلب...';
    spinner.hidden = false;

    const orderData = {
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        product: currentConfig.title,
        price: currentConfig.price,
        status: "قيد الانتظار",
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "orders"), orderData);
        showSuccess(orderData);
        e.target.reset();
    } catch (err) {
        alert('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.');
        console.error("Order Error:", err);
    } finally {
        submitBtn.disabled = false;
        btnText.innerText = 'تأكيد الطلب الآن';
        spinner.hidden = true;
    }
});

// ============ 6. رسالة النجاح + تحويل واتساب اختياري ============
function showSuccess(orderData) {
    const overlay = $('success-overlay');
    const waBtn = $('success-whatsapp-btn');
    if (!overlay) return;

    if (currentConfig.whatsapp) {
        const digits = currentConfig.whatsapp.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(
            `مرحباً، لقد قمت بطلب "${orderData.product}"\nالاسم: ${orderData.name}\nالهاتف: ${orderData.phone}\nالمدينة: ${orderData.city}`
        );
        waBtn.hidden = false;
        waBtn.onclick = () => window.open(`https://wa.me/${digits}?text=${message}`, '_blank');
    } else if (waBtn) {
        waBtn.hidden = true;
    }

    overlay.classList.add('visible');
}

$('success-close-btn')?.addEventListener('click', () => {
    $('success-overlay')?.classList.remove('visible');
});

// ============ 7. حقن أكواد التتبع (Pixels) ============
function injectPixels(pixelsHtml) {
    if (!pixelsHtml || pixelsInjected) return;
    const container = $('pixel-container');
    if (!container) return;

    const temp = document.createElement('div');
    temp.innerHTML = pixelsHtml;

    temp.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        [...oldScript.attributes].forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.text = oldScript.textContent;
        document.head.appendChild(newScript);
    });

    // أي عناصر noscript أو غير script تُضاف كما هي
    temp.querySelectorAll(':not(script)').forEach((node) => {
        if (node.parentElement === temp) container.appendChild(node.cloneNode(true));
    });

    pixelsInjected = true;
}

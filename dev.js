// dev.js — لوحة المبرمج
import {
    db, auth, doc, onSnapshot, setDoc,
    signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

// ============ إعدادات ثابتة ============
const COLOR_FIELDS = [
    { key: 'bg',          label: 'خلفية الصفحة',            fallback: '#FBF5F1' },
    { key: 'card',        label: 'خلفية البطاقات',          fallback: '#FFFFFF' },
    { key: 'text',        label: 'لون النص الأساسي',        fallback: '#2B1B24' },
    { key: 'textSoft',    label: 'لون النص الثانوي',        fallback: '#6B5560' },
    { key: 'primary',     label: 'اللون الأساسي (السعر/الأزرار)', fallback: '#A8324A' },
    { key: 'primaryDark', label: 'اللون الأساسي الغامق',    fallback: '#7E2438' },
    { key: 'accent',      label: 'لون التمييز (الإطارات)',  fallback: '#B08D57' }
];

const HEADING_FONTS = [
    { name: 'Aref Ruqaa', label: 'كلاسيكي' },
    { name: 'Amiri', label: 'تقليدي' },
    { name: 'Changa', label: 'عصري' },
    { name: 'Cairo', label: 'بسيط' }
];

const BODY_FONTS = [
    { name: 'Tajawal', label: 'Tajawal' },
    { name: 'Cairo', label: 'Cairo' },
    { name: 'Almarai', label: 'Almarai' },
    { name: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans' }
];

let selectedHeadingFont = 'Aref Ruqaa';
let selectedBodyFont = 'Tajawal';
let selectedGalleryMode = 'fade';
let currentColors = {};

// ============ تسجيل الدخول / الخروج ============
onAuthStateChanged(auth, (user) => {
    const loginScreen = $('login-screen');
    const devDashboard = $('dev-dashboard');
    if (user) {
        loginScreen.style.display = 'none';
        devDashboard.style.display = 'block';
        loadContentSettings();
        loadDesignSettings();
    } else {
        loginScreen.style.display = 'flex';
        devDashboard.style.display = 'none';
    }
});

$('toggle-pass')?.addEventListener('click', () => {
    const input = $('login-pass');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    $('toggle-pass').innerText = isPass ? 'إخفاء' : 'إظهار';
});

$('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('login-email').value;
    const pass = $('login-pass').value;
    const errorBox = $('login-error');
    const submitBtn = $('login-submit');

    errorBox.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري الدخول...';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        errorBox.innerText = 'البريد الإلكتروني أو كلمة السر غير صحيحة';
        errorBox.classList.add('visible');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'دخول';
    }
});

$('logout-btn')?.addEventListener('click', () => signOut(auth));

// ============ التبويبات ============
document.querySelectorAll('.dev-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.dev-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        $(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

// ============ تبويب المحتوى ============
function loadContentSettings() {
    onSnapshot(doc(db, "settings", "landing_page"), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        $('set-title').value = data.title || '';
        $('set-desc').value = data.desc || '';
        $('set-price').value = data.price || '';
        $('set-oldprice').value = data.oldPrice || '';
        $('set-whatsapp').value = data.whatsapp || '';
        $('set-pixels').value = data.pixels || '';
        if (Array.isArray(data.images)) {
            $('set-images-list').value = data.images.join('\n');
            renderImagePreviews(data.images);
        }
        updatePreviewText(data);
    });
}

function renderImagePreviews(images) {
    const wrap = $('image-preview-row');
    if (!wrap) return;
    wrap.innerHTML = '';
    images.slice(0, 10).forEach((url) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };
        wrap.appendChild(img);
    });
}

$('set-images-list')?.addEventListener('input', (e) => {
    const urls = e.target.value.split('\n').map((u) => u.trim()).filter(Boolean);
    renderImagePreviews(urls);
});

$('set-title')?.addEventListener('input', (e) => setText($('lp-title'), e.target.value || 'اسم المنتج'));
$('set-desc')?.addEventListener('input', (e) => setText($('lp-desc'), e.target.value || 'وصف مختصر وجذاب للمنتج يظهر هنا للزبون'));
$('set-price')?.addEventListener('input', (e) => setText($('lp-price'), `${e.target.value || 0} د.م`));

function setText(el, val) { if (el) el.innerText = val; }

$('content-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = $('save-content-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const imagesArr = $('set-images-list').value.split('\n').map((url) => url.trim()).filter(Boolean);

    try {
        await setDoc(doc(db, "settings", "landing_page"), {
            title: $('set-title').value,
            desc: $('set-desc').value,
            price: $('set-price').value,
            oldPrice: $('set-oldprice').value,
            whatsapp: $('set-whatsapp').value,
            pixels: $('set-pixels').value,
            images: imagesArr
        }, { merge: true });
        showToast('تم حفظ المحتوى بنجاح', 'success');
    } catch (err) {
        showToast('تعذر حفظ المحتوى', 'error');
        console.error(err);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ المحتوى';
    }
});

// ============ تبويب التصميم ============
function buildColorGrid() {
    const grid = $('color-grid');
    if (!grid) return;
    grid.innerHTML = '';
    COLOR_FIELDS.forEach((field) => {
        const wrap = document.createElement('div');
        wrap.className = 'color-field';
        wrap.innerHTML = `
            <div class="swatch-wrap">
                <input type="color" id="color-${field.key}" value="${field.fallback}">
            </div>
            <div class="color-meta">
                <label class="color-label">${field.label}</label>
                <input type="text" class="hex-input" id="hex-${field.key}" value="${field.fallback}">
            </div>
        `;
        grid.appendChild(wrap);
    });

    COLOR_FIELDS.forEach((field) => {
        const colorInput = $(`color-${field.key}`);
        const hexInput = $(`hex-${field.key}`);
        colorInput.addEventListener('input', () => {
            hexInput.value = colorInput.value;
            currentColors[field.key] = colorInput.value;
            updatePreviewColors();
        });
        hexInput.addEventListener('input', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
                colorInput.value = hexInput.value;
                currentColors[field.key] = hexInput.value;
                updatePreviewColors();
            }
        });
    });
}

function setColorValues(colors) {
    COLOR_FIELDS.forEach((field) => {
        const val = (colors && colors[field.key]) || field.fallback;
        currentColors[field.key] = val;
        const colorInput = $(`color-${field.key}`);
        const hexInput = $(`hex-${field.key}`);
        if (colorInput) colorInput.value = val;
        if (hexInput) hexInput.value = val;
    });
    updatePreviewColors();
}

$('reset-colors-btn')?.addEventListener('click', () => {
    const defaults = {};
    COLOR_FIELDS.forEach((f) => { defaults[f.key] = f.fallback; });
    setColorValues(defaults);
});

function buildFontGrid(containerId, fonts, isHeading) {
    const grid = $(containerId);
    if (!grid) return;
    grid.innerHTML = '';
    fonts.forEach((font) => {
        const card = document.createElement('div');
        card.className = 'font-option';
        card.dataset.font = font.name;
        card.innerHTML = `
            <div class="font-preview" style="font-family:'${font.name}', ${isHeading ? 'serif' : 'sans-serif'};">جميلتي</div>
            <div class="font-name">${font.label}</div>
        `;
        card.addEventListener('click', () => {
            grid.querySelectorAll('.font-option').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
            if (isHeading) { selectedHeadingFont = font.name; } else { selectedBodyFont = font.name; }
            updatePreviewFonts();
        });
        grid.appendChild(card);
    });
}

function setFontSelection(containerId, fontName) {
    const grid = $(containerId);
    if (!grid) return;
    grid.querySelectorAll('.font-option').forEach((c) => {
        c.classList.toggle('selected', c.dataset.font === fontName);
    });
}

document.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedGalleryMode = card.dataset.mode;
    });
});

$('set-autoplay')?.addEventListener('change', (e) => {
    $('speed-row').classList.toggle('visible', e.target.checked);
});

$('set-interval')?.addEventListener('input', (e) => {
    $('speed-value').innerText = `${e.target.value} ثواني`;
});

$('set-sitename')?.addEventListener('input', (e) => {
    setText($('lp-topbar'), `✦ ${e.target.value || 'جميلتي'}`);
});

function updatePreviewColors() {
    const lpTopbar = $('lp-topbar');
    const lpBody = $('lp-body');
    const lpCard = $('lp-card');
    const lpTitle = $('lp-title');
    const lpDesc = $('lp-desc');
    const lpPrice = $('lp-price');
    const lpBtn = $('lp-btn');

    if (lpTopbar) { lpTopbar.style.background = currentColors.text || '#2B1B24'; lpTopbar.style.color = '#fff'; }
    if (lpBody) lpBody.style.background = currentColors.bg || '#FBF5F1';
    if (lpCard) lpCard.style.background = currentColors.card || '#FFFFFF';
    if (lpTitle) lpTitle.style.color = currentColors.text || '#2B1B24';
    if (lpDesc) lpDesc.style.color = currentColors.textSoft || '#6B5560';
    if (lpPrice) lpPrice.style.color = currentColors.primary || '#A8324A';
    if (lpBtn) lpBtn.style.background = currentColors.primary || '#A8324A';
}

function updatePreviewFonts() {
    const lpTitle = $('lp-title');
    const lpTopbar = $('lp-topbar');
    if (lpTitle) lpTitle.style.fontFamily = `'${selectedHeadingFont}', serif`;
    if (lpTopbar) lpTopbar.style.fontFamily = `'${selectedHeadingFont}', serif`;
    const lpBody = $('lp-body');
    if (lpBody) lpBody.style.fontFamily = `'${selectedBodyFont}', sans-serif`;
}

function updatePreviewText(data) {
    if (data.title) setText($('lp-title'), data.title);
    if (data.desc) setText($('lp-desc'), data.desc);
    if (data.price) setText($('lp-price'), `${data.price} د.م`);
}

function loadDesignSettings() {
    buildColorGrid();
    buildFontGrid('heading-font-grid', HEADING_FONTS, true);
    buildFontGrid('body-font-grid', BODY_FONTS, false);

    onSnapshot(doc(db, "settings", "site_design"), (docSnap) => {
        const data = docSnap.exists() ? docSnap.data() : {};

        $('set-sitename').value = data.siteName || '';
        setText($('lp-topbar'), `✦ ${data.siteName || 'جميلتي'}`);

        setColorValues(data.colors || {});

        selectedHeadingFont = (data.fonts && data.fonts.heading) || 'Aref Ruqaa';
        selectedBodyFont = (data.fonts && data.fonts.body) || 'Tajawal';
        setFontSelection('heading-font-grid', selectedHeadingFont);
        setFontSelection('body-font-grid', selectedBodyFont);
        updatePreviewFonts();

        const gallery = data.gallery || { mode: 'fade', autoplay: false, interval: 4 };
        selectedGalleryMode = gallery.mode || 'fade';
        document.querySelectorAll('.mode-card').forEach((c) => {
            c.classList.toggle('selected', c.dataset.mode === selectedGalleryMode);
        });
        $('set-autoplay').checked = !!gallery.autoplay;
        $('speed-row').classList.toggle('visible', !!gallery.autoplay);
        $('set-interval').value = gallery.interval || 4;
        $('speed-value').innerText = `${gallery.interval || 4} ثواني`;
    });
}

$('save-design-btn')?.addEventListener('click', async () => {
    const btn = $('save-design-btn');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';

    try {
        await setDoc(doc(db, "settings", "site_design"), {
            siteName: $('set-sitename').value,
            colors: { ...currentColors },
            fonts: { heading: selectedHeadingFont, body: selectedBodyFont },
            gallery: {
                mode: selectedGalleryMode,
                autoplay: $('set-autoplay').checked,
                interval: Number($('set-interval').value) || 4
            }
        }, { merge: true });
        showToast('تم حفظ التصميم — شاهد النتيجة في صفحة المنتج', 'success');
    } catch (err) {
        showToast('تعذر حفظ التصميم', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'حفظ التصميم';
    }
});

// ============ الإشعارات (Toasts) ============
function showToast(message, type = 'success') {
    const stack = $('toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

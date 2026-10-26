/* =========================================================
   WEBGIS VUNCY
   Struktur:
   1. Konfigurasi peta dan basemap
   2. Konfigurasi kelas kebisingan
   3. State aplikasi
   4. Fungsi klasifikasi dan legenda
   5. Fungsi rendering dan filter layer
   6. Pemuatan GeoJSON
   7. Interaksi pengguna
   ========================================================= */
/* =========================================================
   1. KONFIGURASI PETA DAN BASEMAP
   ========================================================= */

const INITIAL_CENTER = [48.13870520287456, 11.567453348903609];
const INITIAL_ZOOM = 14;

const map = L.map('map').setView(INITIAL_CENTER, INITIAL_ZOOM);

// Basemap OpenStreetMap
const osm = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
);

// Basemap CARTO
// Catatan: API key sebelumnya diletakkan langsung di file JavaScript.
// Jika key ini aktif dan memiliki kuota/batas akses, pertimbangkan membatasi
// key berdasarkan domain melalui penyedia layanan.
const CARTO_API_KEY = 'cb1_4g4f_1_42d109ba0c599cd10ee54314';

const positron = L.tileLayer(
    `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 20
    }
);

const darkMatter = L.tileLayer(
    `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 20
    }
);

const voyager = L.tileLayer(
    `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 20
    }
);

// Basemap Esri Satellite
const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles &copy; Esri and its imagery contributors'
    }
);


// Basemap MapTiler Streets
const mapTilerApiKey = '473J5Bo47m0I4Vqpz6f3'; // Ganti dengan API key MapTiler Anda jika perlu

const mapTilerStreets = L.tileLayer(
    `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerApiKey}`,
    {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
        attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' +
            '&copy; <a href="https://www.openstreetmap.org/copyright">' +
            'OpenStreetMap contributors</a>'
    }
);


// Basemap awal
osm.addTo(map);

// Kontrol basemap menggunakan perilaku bawaan Leaflet.
// Hindari event klik manual pada tombol kontrol karena dapat mengganggu
// interaksi pilihan basemap.
L.control.layers(
    {
        'OpenStreetMap': osm,
        'CARTO Positron': positron,
        'CARTO Dark Matter': darkMatter,
        'CARTO Voyager': voyager,
        'Esri Satellite': satellite,
        'MapTiler Streets': mapTilerStreets
    },
    null,
    {
        position: 'topright',
        collapsed: true
    }
).addTo(map);


/* =========================================================
   2. KONFIGURASI KELAS KEBISINGAN
   ========================================================= */

// Urutan indeks: rendah -> tinggi.
// Indeks 0 = kelas terendah; indeks 4 = kelas tertinggi.
const isoclassOrder = [
    '<35 dB',
    '35-44 dB',
    '45-54 dB',
    '55-64 dB',
    '>65 dB'
];

// Warna harus mengikuti urutan isoclassOrder di atas.
const isoclassColors = [
    '#E5C7EC', // <35 dB
    '#C99AD5', // 35-44 dB
    '#A96DBB', // 45-54 dB
    '#7A408E', // 55-64 dB
    '#4F1D63'  // >65 dB
];

// Nilai ISOLABEL asli -> kelas legenda yang digunakan pada peta.
const noiseClassification = {
    '-35': '<35 dB',
    '35-40': '35-44 dB',
    '40-45': '35-44 dB',
    '45-50': '45-54 dB',
    '50-55': '45-54 dB',
    '55-60': '55-64 dB',
    '60-65': '55-64 dB',
    '65-70': '>65 dB',
    '70-75': '>65 dB',
    '75-80': '>65 dB'
};


/* =========================================================
   3. STATE APLIKASI DAN ELEMEN HTML
   ========================================================= */

// Data GeoJSON yang sudah dimuat.
const datasets = {
    D: null,
    E: null,
    N: null,
    DEN: null
};

// Layer dan dataset yang sedang aktif.
let activeLayer = null;
let activeDataset = null;
let dataReady = false;

// Slider dataset D / E / N / DEN yang sudah ada di HTML.
const datasetSlider = document.getElementById('dataset-slider');

if (datasetSlider) {
    datasetSlider.disabled = true;
} else {
    console.error('Elemen #dataset-slider tidak ditemukan.');
}


/* =========================================================
   4. FUNGSI KLASIFIKASI DAN LEGENDA
   ========================================================= */

/**
 * Mengubah nilai ISOLABEL menjadi kelas legenda.
 * Nilai yang tidak dikenal akan dikembalikan sebagai "Tidak diketahui".
 */
function reclassifyNoise(isolabel) {
    const value = String(isolabel ?? '').trim();
    return noiseClassification[value] ?? 'Tidak diketahui';
}

/**
 * Mengambil warna berdasarkan label kelas hasil reklasifikasi.
 */
function getIsoClassColor(label) {
    const index = isoclassOrder.indexOf(String(label ?? '').trim());

    return index === -1
        ? '#BDBDBD'
        : isoclassColors[index];
}

/**
 * Membuat legenda statis: label dB, kotak warna, dan slider ambang.
 * Slider mulai pada indeks 4 agar semua kelas tampil saat awal.
 */
function createStaticIsoClassControl() {
    const container = document.getElementById('isoclass-control');

    if (!container) {
        console.error('Elemen #isoclass-control tidak ditemukan.');
        return;
    }

    // Urutan visual dari atas ke bawah: kelas tertinggi -> terendah.
    const descendingClasses = [...isoclassOrder].reverse();

    container.innerHTML = `
        <div class="noise-legend">
            <div class="noise-label-column">
                ${descendingClasses.map(label => `
                    <div class="noise-legend-item">${label}</div>
                `).join('')}
            </div>

            <div class="noise-color-column">
                ${descendingClasses.map(label => {
                    const index = isoclassOrder.indexOf(label);

                    return `
                        <div
                            class="noise-color-swatch"
                            data-class="${label}"
                            style="background-color: ${isoclassColors[index]}"
                        ></div>
                    `;
                }).join('')}
            </div>

            <div class="noise-slider-column">
                <input
                    type="range"
                    id="noise-class-slider"
                    class="noise-class-slider"
                    min="0"
                    max="${isoclassOrder.length - 1}"
                    step="1"
                    value="${isoclassOrder.length - 1}"
                    aria-label="Atur ambang kelas kebisingan"
                >
            </div>
        </div>
    `;

    const slider = document.getElementById('noise-class-slider');

    if (!slider) {
        console.error('Slider kelas kebisingan gagal dibuat.');
        return;
    }

    // Posisi paling atas = indeks tertinggi = semua kelas ditampilkan.
    slider.value = String(isoclassOrder.length - 1);
    updateNoiseSliderAppearance();

    // Event listener dipasang sekali, saat legenda dibuat.
    slider.addEventListener('input', () => {
        updateNoiseSliderAppearance();
        updateIsoClassVisibility();
    });
}

/**
 * Mengubah warna thumb slider mengikuti kelas pada posisi yang dipilih.
 * Track tetap menggunakan warna statis dari CSS.
 */
function updateNoiseSliderAppearance() {
    const slider = document.getElementById('noise-class-slider');
    if (!slider) return;

    const index = Number(slider.value);
    const selectedColor = isoclassColors[index] ?? isoclassColors[4];

    slider.style.setProperty('--thumb-color', selectedColor);
}


/* =========================================================
   5. FUNGSI RENDERING LAYER DAN POPUP
   ========================================================= */

/**
 * Membuat layer GeoJSON untuk dataset terpilih.
 * Filter slider diterapkan kembali setelah layer baru dibuat.
 */
function showDataset(datasetName) {
    if (!dataReady) {
        console.warn('Dataset belum selesai dimuat.');
        return;
    }

    const data = datasets[datasetName];

    if (!data) {
        console.error(`Dataset "${datasetName}" tidak tersedia.`);
        return;
    }

    // Hapus layer dataset sebelumnya.
    if (activeLayer) {
        map.removeLayer(activeLayer);
    }

    activeLayer = L.geoJSON(data, {
        style: feature => {
            const properties = feature.properties ?? {};
            const noiseClass = reclassifyNoise(properties.ISOLABEL);

            return {
                color: '#8B0000',
                weight: 0,
                fillColor: getIsoClassColor(noiseClass),
                fillOpacity: 0.8
            };
        },

        onEachFeature: (feature, layer) => {
            const properties = feature.properties ?? {};
            const noiseClass = reclassifyNoise(properties.ISOLABEL);

            // Escape nilai atribut sebelum dimasukkan ke popup.
            const safe = value => escapeHtml(String(value ?? '-'));

            layer.bindPopup(`
                <div class="noise-popup">
                    <strong>Noise Map</strong>

                    <div class="popup-row">
                        <b>Dataset</b><span>:</span><span>${safe(datasetName)}</span>
                    </div>

                    <div class="popup-row">
                        <b>ISOCLASS</b><span>:</span><span>${safe(noiseClass)}</span>
                    </div>

                    <div class="popup-row">
                        <b>ISOLVL</b><span>:</span><span>${safe(properties.ISOLVL)}</span>
                    </div>

                    <div class="popup-row">
                        <b>CELL_ID</b><span>:</span><span>${safe(properties.CELL_ID)}</span>
                    </div>

                    <div class="popup-row">
                        <b>PERIOD</b><span>:</span><span>${safe(properties.PERIOD)}</span>
                    </div>
                </div>
            `);
        }
    });

    activeLayer.addTo(map);
    activeDataset = datasetName;

    // Pertahankan ambang slider saat berpindah dataset.
    updateIsoClassVisibility();

    console.log(
        `Dataset aktif: ${activeDataset}; jumlah fitur: ${activeLayer.getLayers().length}`
    );
}

/**
 * Melindungi nilai atribut sebelum digunakan sebagai HTML popup.
 */
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


/* =========================================================
   6. FILTER VISIBILITAS BERDASARKAN SLIDER KELAS
   ========================================================= */

/**
 * Slider adalah ambang maksimum kelas yang terlihat:
 * - Indeks 4 (paling atas): semua kelas terlihat.
 * - Indeks 3: kelas >65 dB disembunyikan.
 * - Indeks 2: kelas 55-64 dB dan >65 dB disembunyikan.
 * - Indeks 1: hanya kelas <45 dB yang terlihat.
 * - Indeks 0 (paling bawah): hanya kelas <35 dB yang terlihat.
 */
function updateIsoClassVisibility() {
    if (!activeLayer) return;

    const slider = document.getElementById('noise-class-slider');
    if (!slider) return;

    const thresholdIndex = Number(slider.value);

    activeLayer.eachLayer(layer => {
        const properties = layer.feature?.properties ?? {};
        const label = reclassifyNoise(properties.ISOLABEL);
        const classIndex = isoclassOrder.indexOf(label);

        const isVisible =
            classIndex !== -1 && classIndex <= thresholdIndex;

        layer.setStyle({
            opacity: isVisible ? 1 : 0,
            fillOpacity: isVisible ? 0.8 : 0
        });
    });
}


/* =========================================================
   7. PEMUATAN DATA GEOJSON
   ========================================================= */

/**
 * Memuat empat GeoJSON secara paralel.
 * Aplikasi baru mengaktifkan slider dataset setelah semua data siap.
 */
async function loadDatasets() {
    const files = {
        D: 'assets/clipmunich/clipD.geojson',
        E: 'assets/clipmunich/clipE.geojson',
        N: 'assets/clipmunich/clipN.geojson',
        DEN: 'assets/clipmunich/clipDEN.geojson'
    };

    try {
        const entries = Object.entries(files);

        const results = await Promise.all(
            entries.map(async ([name, url]) => {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(
                        `Gagal memuat ${url} (HTTP ${response.status})`
                    );
                }

                return [name, await response.json()];
            })
        );

        // Simpan semua dataset setelah seluruh permintaan berhasil.
        results.forEach(([name, data]) => {
            datasets[name] = data;
        });

        dataReady = true;

        // Buat kontrol legenda setelah elemen dan data siap.
        createStaticIsoClassControl();

        if (datasetSlider) {
            datasetSlider.value = '0';
            datasetSlider.disabled = false;
        }

        // Dataset awal D; slider kelas berada di posisi paling atas,
        // sehingga semua kelas kebisingan ditampilkan.
        showDataset('D');

        map.setView(INITIAL_CENTER, INITIAL_ZOOM, {
            animate: false
        });

        console.info('Semua dataset GeoJSON berhasil dimuat.');
    } catch (error) {
        dataReady = false;

        if (datasetSlider) {
            datasetSlider.disabled = true;
        }

        console.error('Gagal memuat dataset:', error);
    }
}

/* =========================================================
   8. INTERAKSI SLIDER DATASET D / E / N / DEN
   ========================================================= */

// Pemetaan indeks slider ke nama dataset.
const datasetOptions = ['D', 'E', 'N', 'DEN'];

if (datasetSlider) {
    datasetSlider.addEventListener('input', function () {
        if (!dataReady) return;

        const datasetName = datasetOptions[Number(this.value)];

        if (datasetName) {
            showDataset(datasetName);
        }
    });
}


/* =========================================================
   9. MULAI APLIKASI
   ========================================================= */

loadDatasets();
console.log('WebGIS VUNCY: inisialisasi selesai.');

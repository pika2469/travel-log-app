import './style.css';

// -----------------------------------------------------
//  初期化処理：都市・省のキャッシュ
// -----------------------------------------------------
function initializeCityProvinceMapping() {
    // if (localStorage.getItem('cityProvinceLocationMapping')) {
    //     console.log("キャッシュはすでに存在しています");
    //     return;
    // }

    localStorage.removeItem('cityProvinceLocationMapping')

    // キャッシュが存在しない場合はcsvファイルから都市と省のデータを読み込む
    const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';
    fetch(`${basePath}china_cities.csv`)
        .then(response => response.text())
        .then(csvText => {
            const cityProvinceLocationMapping = {};
            const lines = csvText
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 0);

            const headers = lines[0].split(",").map(h => h.trim());

            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(",").map(cell => cell.trim());
                if (row.length !== headers.length) continue;

                const rowData = {};
                headers.forEach((header, idx) => {
                    rowData[header] = row[idx];
                });

                const city1 = rowData['city_name_zh'];
                const city2 = rowData['city_name_zh2'];
                const provinceZh = rowData['province_name_zh'];
                const provinceEn = rowData['province_name_en'];
                const lat = parseFloat(rowData['Latitude']);
                const lon = parseFloat(rowData['Longitude']);

                if (city1) {
                    cityProvinceLocationMapping[city1] = {province_zh: provinceZh, province_en: provinceEn, lat, lon};
                }
                if (city2) {
                    cityProvinceLocationMapping[city2] = {province_zh: provinceZh, province_en: provinceEn, lat, lon};
                }
            }

            localStorage.setItem("cityProvinceLocationMapping", JSON.stringify(cityProvinceLocationMapping));
            console.log("map.js側で都市と省のキャッシュを初期化しました")
        })
        .catch(error => console.error("csvの読込に失敗しました:", error));
}

// -----------------------------------------------------
// restMap : すべてのレイヤーを消去して背景タイルを再追加
// -----------------------------------------------------
function resetMap(map) {
    map.eachLayer(layer => map.removeLayer(layer));
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    className: 'leaflet-dark-bg',
    attribution: '© OpenStreetMap contributors, © CARTO'
  }).addTo(map);
}

// -----------------------------------------------------
// 世界地図全体を黒ベールにする関数
// -----------------------------------------------------
function addWorldBlackMask(map, geojson) {
    L.geoJSON(geojson, {
        style: {
            fillColor: '#111',
            stroke: false,
            fillOpacity: 1
        },
        interactive: false
    }).addTo(map);
}

// -----------------------------------------------------
// 世界ボタン描画
// -----------------------------------------------------
function renderWorldMode(map, visitedCountryCodes, worldGeojson) {
    addWorldBlackMask(map, worldGeojson);

    L.geoJSON(worldGeojson, {

        style: feature => {
            const countryCode = feature.id?.toUpperCase(); // 例: "CHN"

            if (visitedCountryCodes.includes(countryCode)){
                return{
                    fillColor: '#a7d8ff',
                    color: '#5eaada',
                    weight: 1,
                    // stroke: false,
                    fillOpacity: 0.3
                };
            } else {
                return{
                    fillColor: '#111',
                    stroke: false,
                    // color: 'transparent',
                    // weight: 0,
                    fillOpacity: 1 
                };
            }
        },

        onEachFeature: (feature, layer) => {

            // ログがある国のみ、クリック時に詳細ウィンドウを追加
            const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
            const featureCode = feature.id?.toUpperCase(); // geoJSONファイルからid = 3桁コード取得

            // ログの3桁コードとgeoJSONファイルの3桁コードが一致するログのみ抽出
            const matchingLogs = logs.filter(log => log.country === featureCode);

            if (matchingLogs.length > 0) {
                // 該当する国にクリックイベントを追加
                layer.on('click', (e) => {
                    createInfoPanel(e.originalEvent, matchingLogs);
                });
            }
        }
    }).addTo(map);
}    

// -----------------------------------------------------
// 中国モード描画
// -----------------------------------------------------
function renderChinaMode(map, worldGeojson, chinaGeojson) {

    // まず地図を黒色にマスキング
    addWorldBlackMask(map, worldGeojson)

    // キャッシュデータ読込
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
    const cityMap = JSON.parse(localStorage.getItem("cityProvinceLocationMapping") || "{}");

    // 訪問した省をまとめるための空オブジェクトを作成
    const visitedProvinces = new Set()

    // ピンを立てる必要のある都市をまとめるための空のオブジェクトを作成
    const pinQueue = [];

    // 旅の記録に登録されている各都市について処理を実行
    logs.forEach(log => {
        if (!log.location.includes("中国")) return;

        const city = log.location.split("、")[0];
        const info = cityMap[city];
        if (!info) return;

        const {lat, lon, province_zh, province_en} = info;
        visitedProvinces.add(province_en);

        if (lat && lon) {
            pinQueue.push({lat, lon, city, province_zh});
        }
    });
    
    // 省レイヤー
    const chinaLayer = L.geoJSON(chinaGeojson, {
        style: feature => {
            const provinceNameEn = feature.properties.name;
            return visitedProvinces.has(provinceNameEn)
                ? {
                    fillColor: '#a7d8ff',
                    color: '#5eaada',
                    weight: 1,
                    fillOpacity: 0.3
                }
                : {
                    fillColor: '#222',
                    color: '#333',
                    weight: 0.5,
                    fillOpacity: 0.2
                };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', (e) => {
                const provinceEn = feature.properties.name;
                const matchingLogs = logs.filter(log => {
                    const city = log.location.split("、")[0];
                    const info = cityMap[city];
                    return info && info.province_en === provinceEn;
                });
                createInfoPanel(e.originalEvent, matchingLogs);
            });
        }
    }).addTo(map);
    
    // fitBoundsで中国全体を表示
    map.fitBounds(chinaLayer.getBounds());

    // ピンを一括描画
    pinQueue.forEach(({lat, lon, city, province_zh}) => {
        L.circleMarker([lat, lon], {
            radius: 3,
            fillColor: '#0057b7',
            color: '#003f88',
            weight: 1,
            opacitiy: 1,
            fillOpacity: 0.9
        }).addTo(map).bindPopup(`<strong>${city}</strong><br>${province_zh}`);
    });
}



// -----------------------------------------------------
// クリックした地域の詳細記録をパネルに表示する関数
// -----------------------------------------------------
function createInfoPanel(event, logs) {
    let popup = document.getElementById('info-popup');

    // 既存のポップアップを削除
    if (popup) popup.remove();

    // 記録が1件もない場合はポップアップを生成しない
    if (logs.length === 0) return;

    // 新しいポップアップを作成
    popup = document.createElement('div');
    popup.id = 'info-popup';
    popup.style.position = 'absolute';
    popup.style.backgroundColor = 'rgba(15,15,20,0.6)';
    popup.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    popup.style.color = 'white';
    popup.style.borderRadius = '12px';
    popup.style.padding = '10px';
    popup.style.MaxWidth = '300px';
    popup.style.maxHeight = '300px';
    popup.style.overflowY = 'auto';
    popup.style.display = 'flex';
    popup.style.flexDirection = 'column';
    popup.style.gap = '10px';
    popup.style.backdropFilter = 'blur(8px)';
    popup.style.zIndex = 1000;
    popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'
    popup.style.fontSize = '0.8rem';0

    document.body.appendChild(popup);

    // ログカード生成
    logs.forEach(log => {
    const card = document.createElement('div');
    card.className = 'log-card';
    card.style.backgorundColor = 'rgba(255, 255, 255, 0.05)';
    card.style.color = 'white';
    card.style.padding = '8px';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid rgba(255,255,255,0.1)';
    card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    
    // 内容行
    const contentRow = document.createElement('div');
    contentRow.style.display = 'flex';
    contentRow.style.gap = '8px';
    contentRow.style.flexWrap = 'wrap';
    contentRow.style.alignItems = 'center';
    // contentRow.style.fontSize = '0.9rem';
    contentRow.style.lineHeight = '1.4';

    // 日付
    const dateSpan = document.createElement('span');
    dateSpan.textContent = log.date;

    // 都市名
    const citySpan = document.createElement('span');
    citySpan.textContent = log.location.split('、')[0];

    // contentRow.appendChild(titleSpan);
    contentRow.appendChild(dateSpan);
    contentRow.appendChild(citySpan);
    card.appendChild(contentRow);
    popup.appendChild(card);
    })

    // ----------画面端調整-------------
    const padding = 10;
    const { innerWidth, innerHeight } = window;
    const popupRect = popup.getBoundingClientRect();
    let left = event.x;
    let top = event.y;

    if ((left + popupRect.width + padding) > innerWidth) {
        left = innerWidth - popupRect.width - padding; 
    }
    if ((top + popupRect.height + padding) > innerHeight) {
        top = innerHeight - popupRect.height - padding;
    }
    if (left < padding) left = padding;
    if (top < padding) top = padding;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;


    // 他クリックでパネル非表示
    setTimeout(() => {
    document.addEventListener('click', function handler(evt) {
        if (!popup.contains(evt.target)) {
            popup.remove();
            document.removeEventListener('click', handler);
        }
    })
    }, 10);
}


// --------------------------------------------------------------------
// localStorangeデータに保存されたcountry codeから重複のない配列を返す関数
// --------------------------------------------------------------------
function getVisitedCountryCodesFromStorage() {
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
    const codes = new Set();

    logs.forEach(log => {
        if (log.country) {
            codes.add(log.country.toUpperCase());
        }
    });

    return Array.from(codes);
}

// -----------------------------------------------------
// ページ読込後
// -----------------------------------------------------
initializeCityProvinceMapping();

document.addEventListener("DOMContentLoaded", async() => {

    // 地図の初期化
    const map = L.map('map', { zoomControl: false });
    resetMap(map)

    // GeoJSONデータ読み込み
    const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/';

    const [worldGeojson, chinaGeojson] = await Promise.all([
    fetch(`${basePath}world-110m.geojson`).then(res => res.json()),
    fetch(`${basePath}china-province.geojson`).then(res => res.json())
  ]);

    // info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'info-panel';
    document.body.appendChild(infoPanel);

    // 表示モード切替
    const modeButtons = document.querySelectorAll('[data-mode]');

    // 表示モードを認識するための変数
    let currentMode = "";

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            currentMode = mode;

            // すべてのボタンからactiveクラスを削除
            modeButtons.forEach(b => b.classList.remove('active'));

            // 押したボタンにactiveクラスを追加
            btn.classList.add('active');

            // 地図の初期化
            resetMap(map);

            switch (mode) {
            
                // 世界表示
                case 'world':
                    map.setView([36.2048, 138.2529], 2);
                    resetMap(map);

                    // 地図の色塗り（キャッシュを使用）
                    const visitedCountryCodes = getVisitedCountryCodesFromStorage();
                    renderWorldMode(map, visitedCountryCodes, worldGeojson);
                    break;
                
                // 中国表示
                case 'china':
                    renderChinaMode(map, worldGeojson, chinaGeojson)
                    // map.setView([35.9, 104.1], 5);
                    // resetMap(map);
                    // renderChinaMode(map);
                    break;
                
                // 日本表示
                case 'japan':
                    map.setView([36.2048, 138.2539], 5);
                    resetMap(map);
                    break;
            }
        });       
    });

    // 位置情報のキャッシュを取得する関数
    function  getCachedLocation(location) {
        const cache = JSON.parse(localStorage.getItem("locationCache") || "{}");
        return cache[location] || null;
    }

    // 位置情報をキャッシュに保存する関数
    function cacheLocation(location, lat, lon) {
        const cache = JSON.parse(localStorage.getItem("locationCache") || "{}");
        cache[location] = {lat, lon};
        localStorage.setItem("locationCache", JSON.stringify(cache));
    }

    // localStorageから記録を読み込む
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");

    // マップの境界設定
    const bounds = L.latLngBounds();

    // すべてのfetch処理をPromiseの配列に変換
    const fetchPromises = logs.map(log => {
        const location = log.location;

        // キャッシュがあれば即時返す
        const cached = getCachedLocation(location);
        if (cached) {
            // console.log(`キャッシュヒット: ${location}`);
            return Promise.resolve({lat: cached.lat, lon: cached.lon, log});
        }

        console.log(`キャッシュミス: ${location}`);
        const query = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

        return fetch(query)
            .then(res => res.json())
            .then(data => {
                if(!data || data.length === 0) {
                    console.error(`位置情報が見つかりませんでした: ${location}`);
                    return {lat: null, lon: null, log};
                }

                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                // キャッシュに保存
                cacheLocation(location, lat, lon);

                return {lat, lon, log};
            })
            .catch(err => {
                console.error(`位置情報取得失敗: ${location}`, err);
                return null;
            });
    });

    // すべての処理が完了した後にマーカーを描画
    
    Promise.all(fetchPromises).then(results => {
        
        // 世界モードの場合はピンを表示しない
        if (currentMode !== "world") {
            results.forEach(result => {
                if (result){
                    const {lat, lon, log} = result;

                    // マーカー追加
                    L.circleMarker([lat, lon], {
                        radius: 5,
                        color: '#3366cc',
                        fillColor: '#4a90e2',
                        fillOpacity: 0.8
                    }).addTo(map);

                    // 表示範囲に含める
                    bounds.extend([lat, lon]);
                }
            });
        }        
    });

    // ページ読込時に中国モードを初期選択
    document.querySelector('button[data-mode="china"]').click();
})
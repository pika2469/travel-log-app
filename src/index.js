// import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 都市と省のキャッシュを自動化
function initializeCityProvinceMapping() {
    if (localStorage.getItem('cityProvinceLocationMapping')) {
        console.log("キャッシュはすでに存在しています");
        return;
    }

    // キャッシュが存在しない場合はcsvファイルから都市と省のデータを読み込む
    fetch('/public/china_cities.csv')
        .then(response => response.text())
        .then(csvText => {
            const cityProvinceLocationMapping = {};
            const lines = csvText.split("\n");
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

// 地図をリセットする関数
function resetMap(map) {
    
    // 現在のタイルレイヤーを削除
    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer || layer instanceof L.GeoJSON) {
            map.removeLayer(layer);
        }
    });

    // 白地図レイヤーを追加
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);
}

// クリックした地域の詳細記録をパネルに表示する関数
    function createInfoPanel(event, logs) {
        let popup = document.getElementById('info-popup');
        
        // 既存のポップアップを削除
        if (popup) popup.remove();
        
        // 記録が1件もない場合はポップアップを生成しない
        if (logs.length === 0) return;

        popup = document.createElement('div');
        popup.id = 'info-popup';
        popup.style.position = 'absolute';
        popup.style.backgroundColor = 'rgba(0,0,0,0.85)';
        popup.style.border = '1px solid #444';
        popup.style.color = 'white';
        popup.style.borderRadius = '8px';
        popup.style.padding = '10px';
        popup.style.MaxWidth = '90%';
        popup.style.maxHeight = '300px';
        popup.style.overflowY = 'auto';
        // popup.style.whiteSpace = 'nowrap';
        popup.style.display = 'flex';
        popup.style.flexDirection = 'column';
        popup.style.gap = '10px';
        // popup.style.overflowY = 'auto';
        popup.style.zIndex = 1000;
        document.body.appendChild(popup);

        const {x, y} = event;
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;

        logs.forEach(log => {
            const card = document.createElement('div');
            card.className = 'log-card';
            card.style.backgorundColor = '#4a90e2';
            card.style.color = 'black';
            card.style.padding = '10px';
            card.style.borderRadius = '6px';

            const contentRow = document.createElement('div');
            contentRow.style.display = 'flex';
            contentRow.style.gap = '10px';
            contentRow.style.alignItems = 'center';

            // const titleSpan = document.createElement('span');
            // titleSpan.innerHTML = `<strong>${log.title}</strong>`;

            const dateSpan = document.createElement('span');
            dateSpan.textContent = log.date;

            const citySpan = document.createElement('span');
            citySpan.textContent = log.location.split('、')[0];

            // contentRow.appendChild(titleSpan);
            contentRow.appendChild(dateSpan);
            contentRow.appendChild(citySpan);
            card.appendChild(contentRow);
            popup.appendChild(card);
        })

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

// 初期化処理
initializeCityProvinceMapping();

// DOM読込後に実行
document.addEventListener("DOMContentLoaded", () => {

    // 地図の初期表示（世界全体)
    const map = L.map('map').setView([35.8617, 104.1954], 4);

    resetMap(map);

    // info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'info-panel';
    document.body.appendChild(infoPanel);

    // 表示モード切替
    const modeButtons = document.querySelectorAll('.mode-buttons button');

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // すべてのボタンからactiveクラスを削除
            modeButtons.forEach(b => b.classList.remove('active'));

            // 押したボタンにactiveクラスを追加
            btn.classList.add('active');

            switch (mode) {
            
                // 世界表示
                case 'world':
                    map.setView([20, 0], 2);
                    resetMap(map);

                    // 地図の色塗り（キャッシュを使用）
                    const visitedCountries = getVisitedCountryNamesFromStorage();
                    renderWorldMode(map, visitedCountries);
                    break;
                
                // 中国表示
                case 'china':
                    map.setView([35.817, 104.1954], 4);
                    resetMap(map);

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
                    
                    // ピンを一括描画
                    pinQueue.forEach(({lat, lon, city, province_zh}) => {
                        L.circleMarker([lat, lon], {
                            radius: 6,
                            fillColor: '#4a90e2',
                            color: '#3366cc',
                            weight: 1,
                            opacitiy: 1,
                            fillOpacity: 0.6
                        }).addTo(map).bindPopup(`<strong>${city}</strong><br>${province_zh}`);
                    });

                    // 省の色塗り
                    fetch('/public/china-province.geojson')
                        .then(res => res.json())
                        .then(geojson => {
                            L.geoJSON(geojson, {
                                style: feature => {
                                    const provinceNameEn = feature.properties.name;
                                    return visitedProvinces.has(provinceNameEn)
                                        ? {
                                            fillColor: '#4a90e2',
                                            color: '#3366cc',
                                            weight: 1,
                                            fillOpacity: 0.6
                                        }
                                        : {
                                            fillColor: '#e0e0e0',
                                            color: '#cccccc',
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
                        })
                        .catch(err => {
                            console.error('中国地図のGeoJSON読込に失敗しました:', err);
                        });

                        console.log("中国地図がtravelLogsに基いてGeoJSONで描画されました");
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
            console.log(`キャッシュヒット: ${location}`);
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
                // }).addTo(map).bindPopup(`<strong>${log.title}</strong><br>${log.date}`);

                // 表示範囲に含める
                bounds.extend([lat, lon]);
            }
        });

        // すべてのピンの描画が完了したらズームを行う
        if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.3));
        }
    });

})

// 世界ボタンをクリックした際に色を付ける処理
function renderWorldMode(map, visitedCountryNames) {
    fetch('/world-110m.geojson')
    .then(res => res.json())
    .then(geojson => {
        L.geoJSON(geojson, {
            style: feature => {

                // geojsonデータの国名プロパティを取得
                const countryName = feature.properties.name;

                if(visitedCountryNames.includes(countryName)) {
                    return {
                        fillColor: '#4a90e2',
                        color: '#3366cc',
                        weight: 1,
                        fillOpacity: 0.6
                    };
                } else {
                    return {
                        fillColor: '#e0e0e0',
                        color: '#cccccc',
                        weight: 0.5,
                        fillOpacity: 0.2,
                    };
                }
            },
            onEachFeature: (feature, layer) => {
                layer.on('click', (e) => {
                    const countryName = feature.properties.name;
                    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
                    const matchingLogs = logs.filter(log => log.country === countryName);
                    createInfoPanel(e.originalEvent, matchingLogs);
                });
            }
        }).addTo(map)
    })
    .catch(err => {
        console.error('世界地図の読み込みに失敗しました:', err);
    });
}

// localStorangeデータに保存されたcountryから重複のない配列を返す関数
function getVisitedCountryNamesFromStorage() {
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
    const countries = new Set();

    logs.forEach(log => {
        if (log.country) {
            countries.add(log.country);
        }
    });

    return Array.from(countries);
}

// // 中国の省を色塗りする関数
// function renderChinaMode(map, visitedProvinces) {
//     fetch('/china-province.geojson')
//     .then(res => res.json()) // レスポンスを.json()メソッドで解析しオブジェクトとして扱う
//     .then(geojson => { 

//         L.geoJSON(geojson, { // GeoJSONデータをもとに地図上に描画
//             style: feature => { // 省の見た目を決定する処理
//                 const provinceName = feature.properties.name;

//                 if (visitedProvinces.includes(provinceName)) {
//                     return {
//                         fillColor: '#4a90e2', // 青色
//                         color: '#3366cc',
//                         weight: 1,
//                         fillOpacity: 0.6
//                     };
//                 } else {
//                     return {
//                         fillColor: '#e0e0e0', // グレー
//                         color: '#cccccc',
//                         weight: 0.5,
//                         fillOpacity: 0.2,
//                     };
//                 }
//             }
//         }).addTo(map);
//     })
//     .catch(err => {
//         console.error('中国地図の読み込みに失敗しました:', err);
//     });
// }

// // 省の判定に使用する対応リスト
// const provinceMapping = {
//     "上海": "Shanghai Municipality",
//     "北京": "Beijing Municipality",
//     "天津": "Tianjin Municipality",
//     "重慶": "Chongqing Municipality",
//     "河北": "Hebei Province",
//     "山西": "Shanxi Province",
//     "内モンゴル": "Inner Mongolia Autonomous Region",
//     "遼寧": "Liaoning Province",
//     "吉林": "Jilin Province",
//     "黒竜江": "Heilongjiang Province",
//     "江蘇": "Jiangsu Province",
//     "浙江": "Zhejiang Province",
//     "安徽": "Anhui Province",
//     "福建": "Fujian Province",
//     "江西": "Jiangxi Province",
//     "山東": "Shandong Province",
//     "河南": "Henan Province",
//     "湖北": "Hubei Province",
//     "湖南": "Hunan Province",
//     "広東": "Guangdong Province",
//     "広西": "Guangxi Zhuang Autonomous Region",
//     "海南": "Hainan Province",
//     "四川": "Sichuan Province",
//     "貴州": "Guizhou Province",
//     "雲南": "Yunnan Province",
//     "西蔵": "Tibet Autonomous Region",
//     "陝西": "Shaanxi Province",
//     "甘粛": "Gansu province",
//     "青海": "Qinghai Province",
//     "寧夏": "Ningxia Hui Autonomous Region",
//     "新疆": "Xinjiang Uygur Autonomous Region",
//     "香港": "Hong Kong Special Administrative Region",
//     "澳門": "Macao Special Administrative Region",
//     "台湾": "Taiwan Province"
// };

// // 中国の省リストをlocalStorageから取得する関数
// function getVisitedProvincesFromStorage() {
//     const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
//     const provinces = new Set();

//     logs.forEach(log => {
//         if (log.location.includes('中国')) {

//             // ”省、中国”というスタイルで記録されている前提で、省を取得
//             const province = log.location.split('、')[0];

//             // 対応する英語名に変換して追加
//             if (provinceMapping[province]) {
//                 provinces.add(provinceMapping[province]);
//             }
//         }
//     });

//     return Array.from(provinces);
// }
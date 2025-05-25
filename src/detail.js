import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

document.addEventListener("DOMContentLoaded", () => {
    // URLからIDを取得
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    // URLのクエリパラメータ(?以降の文字列)にidが無い場合はエラー
    if (!id) {
        document.body.innerHTML = "<p>エラー：記録IDが指定されていません。</p>";
        return;
    }

    // localStorageからデータを取得
    const logs = JSON.parse(localStorage.getItem("travelLogs") || "[]");
    const targetLog = logs.find(log => String(log.id) === id);

    //  デバッグ用
    console.log("指定ID:", id);
    console.log("全IDリスト:", logs.map(log => log.id));
    console.log("一致結果:", logs.find(log => String(log.id) === id));

    // ページURLのidに該当するlocalStorageデータが無い場合はエラー
    if (!targetLog) {
        document.body.innerHTML = "<p>該当する記録は見つかりません。</p>";
        return;
    }

    // ページURLのidに該当するlocalStorageデータが見つかった場合
    document.getElementById("title").textContent = targetLog.title;
    document.getElementById("date").textContent = `日付: ${targetLog.date}`;

    // 位置情報を取得して地図にピンを表示する
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetLog.location)}`) 
        .then(response => response.json())
        .then(data => {
            // データが見つからなかった場合の処理
            if (!data || data.length === 0) {
                document.getElementById("map").innerHTML = "<p>地図情報が見つかりませんでした。</p>";
                return;
            }
           
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            const map = L.map('map').setView([lat, lon], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: `&copy; OpenStreetMap contributors`
            }).addTo(map);

            // マーカー追加
            L.marker([lat, lon]).addTo(map)
                .bindPopup(`<strong>${targetLog.title}</strong><br>${targetLog.date}`)
                .openPopup();
        }) 
        .catch(err => {
            console.error("位置情報の取得に失敗しました", err);
            document.getElementById("map").innerHTML = "<p>地図の読み込み中にエラーが発生しました。</p>";
        })

});
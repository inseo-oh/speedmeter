// Copyright 2024 Inseo Oh

let oldCoords;
let oldTime;

function coordDiffInKm(a, b) {
    const latDist = Math.abs(a.latitude - b.latitude);
    const longDist = Math.abs(a.longitude - b.longitude);
    // a와 b 중간 어딘가를 기준 위도로 사용
    const lat = Math.min(a.latitude, b.latitude) + (latDist / 2.0);
    // 1Lat : 110.574km = xLat = yKm
    // 110.574km * xLat = yKm
    const vertKmDist = latDist * 110.574;
    const horiKmDist = longDist * (111.320 * Math.cos(lat * Math.PI));
    const dist = Math.sqrt(vertKmDist * vertKmDist + horiKmDist * horiKmDist);
    return Math.floor(dist * 10) / 10; // 소수점 첫째자리까지만
}

function success(pos) {
    // console.log(pos);
    const currCoords = pos.coords;
    const currTime = pos.timestamp;
    if (oldCoords != undefined) {
        const dist = coordDiffInKm(oldCoords, currCoords);
        const timeDiff = currTime - oldTime; // 단위는 ms
        const spd = (dist * (3600 * 1000)) / timeDiff;
        document.querySelector('.speed').innerText = spd;
    }
    oldCoords = currCoords;
    oldTime = currTime;
    document.querySelector('.lat').innerText = pos.coords.latitude;
    document.querySelector('.long').innerText = pos.coords.longitude;
}
function error(e) {
    document.querySelector('.errbox').style.display = 'block';
    document.querySelector('.errtext').innerText = `${e.message}\n(Code ${e.code})`;
}

window.onload = function() {
    navigator.geolocation.watchPosition(success, error);

}

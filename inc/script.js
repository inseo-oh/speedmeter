// Copyright (c) 2024 Oh Inseo - Licensed under BSD 3-Clause License

// 도 -> 라디안
function rad(x) {
    return (x * Math.PI) / 180;
}
// 2제곱을 구함 (Math.pow(x, 2)와 동일)
function pow2(x) {
    return x * x;
}

function coordDiffInKm(a, b) {
    // 참고: https://www.movable-type.co.uk/scripts/latlong.html
    const R = 6371; // 지구의 반지름
    // 1. 두 위도값의 라디안 값을 구한다
    const lat1$ = rad(a.latitude);
    const lat2$ = rad(b.latitude);
    // 2. 위도, 경도의 차이를 구한다
    const latDelta$ = rad(b.latitude - a.latitude);
    const lonDelta$ = rad(b.longitude - a.longitude);
    // 3. Haversine 식 적용
    const alpha =
        pow2(Math.sin(latDelta$ / 2)) +
        Math.cos(lat1$) * Math.cos(lat2$) * pow2(Math.sin(lonDelta$ / 2));
    const beta = 2 * Math.atan2(Math.sqrt(alpha), Math.sqrt(1 - alpha));
    const dist = R * beta; // 거리 (미터)
    return dist;
}

function makeSegmentDigit() {
    const thickness = 0.2;
    const length = 100;
    const canvas = document.createElement('canvas');
    canvas.width = length;
    canvas.height = length * thickness;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    const middleLength = length - canvas.height; // 양쪽 <> 구간을 제외한 나머지 너비
    const midLeftX = canvas.height / 2;
    const midRightX = midLeftX + middleLength;
    const leftX = 0;
    const rightX = length;
    const topY = 0;
    const midY = canvas.height / 2;
    const botY = canvas.height;
    //       (2)             (3)
    //       ________________
    //      /                \
    // (1) /                  \ (4)
    //     \                  /
    //      \________________/
    //      (6)             (5)
    ctx.moveTo(leftX, midY); // 1)
    ctx.lineTo(midLeftX, topY); // 2)
    ctx.lineTo(midRightX, topY); // 3)
    ctx.lineTo(rightX, midY); // 4)
    ctx.lineTo(midRightX, botY); // 5)
    ctx.lineTo(midLeftX, botY); // 6)
    ctx.closePath();
    ctx.fillStyle = '#493700';
    ctx.fill();

    const url = canvas.toDataURL();
    const box = document.createElement('div');
    box.classList.add('segmentBox');
    for (let i = 0; i < 7; i++) {
        const img = document.createElement('img');
        img.src = url;
        box.append(img);
    }
    return box;
}

class SegmentDigitDisplay {
    #digits = [];

    constructor(wrap, len) {
        const innerWrap = document.createElement('div');
        innerWrap.classList.add('segmentWrap');
        for (let i = 0; i < len; i++) {
            this.#digits.push(makeSegmentDigit());
        }
        innerWrap.append(...this.#digits);
        wrap.append(innerWrap);
    }

    setText(txt) {
        const s = txt.toString();
        for (let i = 0; i < this.#digits.length; i++) {
            const srcIdx = s.length - 1 - i;
            const destIdx = this.#digits.length - 1 - i;
            if (s[srcIdx] === undefined) {
                this.#digits[destIdx].removeAttribute('data-num');
            } else {
                this.#digits[destIdx].setAttribute('data-num', s[srcIdx]);
            }
        }
    }
}

let oldCoords, oldTime;
let speedDisp, tsDisp;
let speedSum = 0;
let speedCnt = 0;
let cover;
let permissonOk = false;

window.onload = function () {
    cover = document.querySelector('.cover');
    const speedWrap = document.querySelector('.displayWrap .speedWrap');
    speedDisp = new SegmentDigitDisplay(speedWrap, 3);
    const tsWrap = document.querySelector('.displayWrap .tsWrap');
    tsDisp = new SegmentDigitDisplay(tsWrap, 16);
    if (navigator.geolocation === undefined) {
        cover.textContent = '브라우저 미지원 (Geolocation API 지원되지 않음)';
        return;
    }
    const initWatch = (alreadyGranted) => {
        cover.textContent = '';
        if (!alreadyGranted) {
            cover.textContent = '화면을 눌러 시작하기';
            cover.onclick = () => {
                cover.onclick = undefined;
                navigator.geolocation.watchPosition(onUpdate, onError);
            };
        } else {
            navigator.geolocation.watchPosition(onUpdate, onError);
        }
    };
    if (navigator.permissions !== undefined) {
        navigator.permissions
            .query({ name: 'geolocation' })
            .then((result) => {
                if (result.state === 'granted') {
                    initWatch(true);
                } else if (result.state == 'denied') {
                    cover.textContent =
                        '위치 권한 거부됨. 브라우저 설정을 확인해주세요.';
                } else {
                    initWatch(false);
                }
            })
            .catch((e) => {
                console.error('permission 상태 구할 수 없음:', e);
                initWatch(false);
            });
    }
    // navigator.geolocation.watchPosition(onUpdate, onError);
};

setInterval(() => {
    if (speedDisp !== undefined) {
        let avgSpd;
        if (speedCnt === 0) {
            avgSpd = 0;
        } else {
            avgSpd = Math.floor(speedSum / speedCnt);
        }
        avgSpd = Math.min(avgSpd, 999);
        speedDisp.setText(avgSpd);
        speedSum = 0;
        speedCnt = 0;
    }
}, 1000);

function onUpdate(pos) {
    permissonOk = true;
    cover.style.display = 'none';
    const currCoords = pos.coords;
    const currTime = pos.timestamp;
    tsDisp.setText(currTime.toString(16).padStart(16, '0'));
    if (oldCoords !== undefined) {
        const dist = coordDiffInKm(oldCoords, currCoords);
        const timeDiff = currTime - oldTime; // 단위는 ms
        const spd = (dist * (3600 * 1000)) / timeDiff;
        speedSum += spd;
        speedCnt++;
    }
    oldCoords = currCoords;
    oldTime = currTime;
}
function onError(e) {
    if (!permissonOk) {
        cover.textContent = `위치 가져오기 실패: ${e.message} (코드 ${e.code}). 창 새로고침 후 다시 시도해주세요.`;
    } else {
        console.error(`위치 가져오기 오류: ${e.message} (Code ${e.code})`);
    }
}

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
    var R = 6371; // 지구의 반지름
    // 1. 두 위도값의 라디안 값을 구한다
    var lat1$ = rad(a.latitude);
    var lat2$ = rad(b.latitude);
    // 2. 위도, 경도의 차이를 구한다
    var latDelta$ = rad(b.latitude - a.latitude);
    var lonDelta$ = rad(b.longitude - a.longitude);
    // 3. Haversine 식 적용
    var alpha =
        pow2(Math.sin(latDelta$ / 2)) +
        Math.cos(lat1$) * Math.cos(lat2$) * pow2(Math.sin(lonDelta$ / 2));
    var beta = 2 * Math.atan2(Math.sqrt(alpha), Math.sqrt(1 - alpha));
    var dist = R * beta; // 거리 (미터)
    return dist;
}

function makeSegmentDigit() {
    var thickness = 0.2;
    var length = 100;
    var canvas = document.createElement('canvas');
    canvas.width = length;
    canvas.height = length * thickness;
    var ctx = canvas.getContext('2d');

    ctx.beginPath();
    var middleLength = length - canvas.height; // 양쪽 <> 구간을 제외한 나머지 너비
    var midLeftX = canvas.height / 2;
    var midRightX = midLeftX + middleLength;
    var leftX = 0;
    var rightX = length;
    var topY = 0;
    var midY = canvas.height / 2;
    var botY = canvas.height;
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

    var url = canvas.toDataURL();
    var box = document.createElement('div');
    box.setAttribute('class', 'segmentBox');
    for (var i = 0; i < 7; i++) {
        var img = document.createElement('img');
        img.src = url;
        box.appendChild(img);
    }
    return box;
}

function SegmentDigitDisplay(wrap, len) {
    var digits = [];
    var innerWrap = document.createElement('div');
    innerWrap.setAttribute('class', 'segmentWrap');
    for (var i = 0; i < len; i++) {
        var digit = makeSegmentDigit();
        digits.push(digit);
        innerWrap.appendChild(digit);
    }
    wrap.appendChild(innerWrap);

    this.setText = function (txt) {
        var s = txt.toString();
        for (var i = 0; i < digits.length; i++) {
            var srcIdx = s.length - 1 - i;
            var destIdx = digits.length - 1 - i;
            if (s[srcIdx] === undefined) {
                digits[destIdx].removeAttribute('data-num');
            } else {
                digits[destIdx].setAttribute('data-num', s[srcIdx]);
            }
        }
    };
}

var oldCoords, oldTime;
var speedDisp, tsDisp;
var cover;
var permissonOk = false;

window.onload = function () {
    cover = document.querySelector('.cover');
    var speedWrap = document.querySelector('.displayWrap .speedWrap');
    speedDisp = new SegmentDigitDisplay(speedWrap, 3);
    var tsWrap = document.querySelector('.displayWrap .tsWrap');
    tsDisp = new SegmentDigitDisplay(tsWrap, 16);
    if (navigator.geolocation === undefined) {
        cover.textContent = 'Geolocation API is not supported by your browser';
        return;
    }
    var initWatch = function (alreadyGranted, notGrantedReason) {
        if (typeof testdata !== 'undefined') {
            console.log('testdata is present. entering simulation mode');
            (function () {
                var testDataIdx = 0;
                function timeoutCallback() {
                    var currTime = testdata[testDataIdx].timestamp;
                    onUpdate(testdata[testDataIdx]);
                    if (testdata[testDataIdx + 1] === undefined) {
                        return;
                    }
                    testDataIdx++;
                    var nextTime = testdata[testDataIdx].timestamp;
                    // setTimeout(nextTime - currTime, timeoutCallback);
                    setTimeout(timeoutCallback, 100);
                }
                setTimeout(timeoutCallback, 0);
            })();
            return;
        }

        cover.textContent = '';
        if (!alreadyGranted) {
            cover.textContent = 'Press screen to start';
            var reasonDiv = document.createElement('div');
            reasonDiv.setAttribute('class', 'reason');
            reasonDiv.textContent = notGrantedReason;
            cover.appendChild(reasonDiv);
            cover.onclick = function () {
                cover.textContent = 'Geolocation requested';
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
            .then(function (result) {
                if (result.state === 'granted') {
                    initWatch(true);
                } else if (result.state == 'denied') {
                    cover.textContent = 'Geolocation permission denied';
                } else if (result.state == 'prompt') {
                    initWatch(false, 'Geolocation permission needed');
                } else {
                    initWatch(
                        false,
                        'Unknown permission state "' + result.state
                    );
                }
            })
            .catch(function (e) {
                initWatch(false, 'permission state unknown: ' + e);
            });
    } else {
        initWatch(false, 'permission API not supported');
    }
};

var speedHistory = [];
var expireTime = 60000;

setInterval(function () {
    // 가장 최근 시간 구함
    var mostRecentTime = 0;
    for (var i = 0; i < speedHistory.length; i++) {
        mostRecentTime = Math.max(speedHistory[i].time);
    }
    // expireTime보다 지난 기록은 삭제
    var removeIndices = [];
    for (var i = 0; i < speedHistory.length; i++) {
        var timeDiff = mostRecentTime - speedHistory[i].time;
        if (expireTime < timeDiff) {
            removeIndices.push(i);
        }
    }
    for (var i = 0; i < removeIndices.length; i++) {
        speedHistory.splice(i, 1);
    }
    // history 바탕으로 평균 속도 추정
    var distSum = 0;
    var timeSum = 0;
    for (var i = 0; i < speedHistory.length; i++) {
        timeSum += speedHistory[i].timeDiff;
        distSum += speedHistory[i].dist;
    }
    var spd;
    if (timeSum === 0) {
        spd = 0;
    } else {
        spd = (distSum * (3600 * 1000)) / timeSum;
    }
    spd = Math.min(spd, 999);
    spd = Math.floor(spd);
    if (speedDisp !== undefined) {
        speedDisp.setText(spd);
    }
}, 1000);

function onUpdate(pos) {
    permissonOk = true;
    cover.style.display = 'none';
    var currCoords = pos.coords;
    var currTime = pos.timestamp;
    tsDisp.setText(currTime.toString(16).padStart(16, '0'));
    var saveCoords = false;
    if (oldCoords !== undefined) {
        var dist = coordDiffInKm(oldCoords, currCoords);
        var timeDiff = currTime - oldTime; // 단위는 ms
        // 지난번 저장된것과 오차범위 밖이면 저장
        if ((dist * 1000) > oldCoords.accuracy) {
            saveCoords = true;
            speedHistory.push({ time: currTime, timeDiff, dist });
        }
    } else {
        saveCoords = true;
    }
    // console.log(saveCoords);
    if (saveCoords) {
        oldCoords = currCoords;
        oldTime = currTime;
    }
}
function onError(e) {
    if (!permissonOk) {
        // prettier-ignore
        cover.textContent = 'Failed to get location: ' + e.message + ' (Code ' + e.code + '). Refresh the page to try again.';
    } else {
        console.error(
            'Failed to get location: ' + e.message + ' (Code ' + e.code + ')'
        );
    }
}

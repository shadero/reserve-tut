"use strict";
// ==UserScript==
// @name        Reserve TUT
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @require		 https://cdn.jsdelivr.net/npm/js-cookie@3.0.5/dist/js.cookie.min.js
// @match        https://service.cloud.teu.ac.jp/portal/mypage/
// @match        https://service.cloud.teu.ac.jp/portal/mypage/?*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// ==/UserScript==
// import Cookies from "js-cookie";
class Config {
    constructor() {
        this.attendSeatId = undefined;
        this.attendDate = undefined;
        this.attendGraceSec = 60 * 50;
        this.sendGraceSec = 60 * 4;
        this.lessonSecsOfDay = [31800, 38700, 47700, 54600, 61500];
    }
    readCookie() {
        const d = Cookies.get("attend_date");
        this.attendDate = d != undefined ? new Date(d) : undefined;
        const id = Cookies.get("attend_seat_id");
        this.attendSeatId = id != undefined ? Number(id) : undefined;
        return this;
    }
    writeCookie() {
        if (this.attendDate == undefined)
            Cookies.remove("attend_date");
        else
            Cookies.set("attend_date", this.attendDate.toString(), { expires: 1 });
        if (this.attendSeatId == undefined)
            Cookies.remove("attend_seat_id");
        else
            Cookies.set("attend_seat_id", String(this.attendSeatId));
    }
}
function main() {
    const config = new Config().readCookie();
    insertReserveUI(config);
    const button = document.getElementById("reserveButton");
    button.addEventListener('click', function () {
        reserveButtonClick(config);
    });
    const time = document.getElementById("sendTime");
    setInterval(() => {
        if (config.attendDate == undefined || config.attendSeatId == undefined) {
            time.textContent = "";
            return;
        }
        const diffSec = (new Date().getTime() - config.attendDate.getTime()) / 1000;
        if (diffSec > 0 && diffSec < 60 * 5) {
            sendAttend(config.attendSeatId);
            config.attendSeatId = undefined;
            config.attendDate = undefined;
            config.writeCookie();
        }
        time.textContent = `${Math.floor(-diffSec / 60)}分${Math.floor(-diffSec % 60)}秒後に出席します。`;
    }, 100);
}
function loopClamp(value, start, end) {
    let fixedIdx = value % end - start;
    if (fixedIdx < 0) {
        fixedIdx += end - start;
    }
    return fixedIdx + start;
}
function getDayDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
}
function getSecOfDay(date) {
    const day = getDayDate(date);
    return (date.getTime() - day.getTime()) / 1000;
}
function searchLessonDate(date, scheduleOfDay, attendGraceSec, when = 0) {
    const searchTargetDate = date;
    if (getSecOfDay(date) < scheduleOfDay[0])
        searchTargetDate.setDate(searchTargetDate.getDate() - 1);
    let lastAttendableIdx = -1;
    for (let i = 0; i < scheduleOfDay.length; i++) {
        const e = scheduleOfDay[i];
        const targetDate = getDayDate(searchTargetDate);
        targetDate.setSeconds(e);
        const diffSec = (searchTargetDate.getTime() - targetDate.getTime()) / 1000;
        if (diffSec > -attendGraceSec)
            lastAttendableIdx = i;
    }
    if (lastAttendableIdx < 0)
        return null;
    if (when == 0) {
        const lastAttendableDate = getDayDate(searchTargetDate);
        lastAttendableDate.setSeconds(scheduleOfDay[lastAttendableIdx]);
        const diffSec = (searchTargetDate.getTime() - lastAttendableDate.getTime()) / 1000;
        return diffSec <= 0 ? lastAttendableDate : null;
    }
    let fixedIdx = lastAttendableIdx + when;
    if (when < 0)
        fixedIdx++;
    const offsetDay = Math.floor(fixedIdx / scheduleOfDay.length);
    fixedIdx = loopClamp(fixedIdx, 0, scheduleOfDay.length);
    const resultDate = getDayDate(searchTargetDate);
    resultDate.setDate(resultDate.getDate() + offsetDay);
    resultDate.setSeconds(resultDate.getSeconds() + scheduleOfDay[fixedIdx]);
    return resultDate;
}
function reserveButtonClick(config) {
    const seatText = document.getElementById("reserveSeatId").value;
    if (seatText == '') {
        alert("座席コードを入力してください");
        return;
    }
    const seatNumber = Number(seatText);
    if (!Number.isInteger(seatNumber)) {
        alert("座席コードは整数を入力してください");
        return;
    }
    // 出席予約可能時間かどうか判定＆設定
    const currentLessonDate = searchLessonDate(new Date(), config.lessonSecsOfDay, config.attendGraceSec);
    if (currentLessonDate == null) {
        let msg = "今は予約できません。";
        const nextLessonDate = searchLessonDate(new Date(), config.lessonSecsOfDay, config.attendGraceSec, 1);
        if (nextLessonDate != null) {
            nextLessonDate.setSeconds(nextLessonDate.getSeconds() - config.attendGraceSec);
            msg += `次回は${nextLessonDate.getHours()}時${nextLessonDate.getMinutes()}分から可能です。`;
        }
        alert(msg);
        return;
    }
    const attendDate = new Date(currentLessonDate.getTime());
    attendDate.setSeconds(attendDate.getSeconds() - config.sendGraceSec);
    config.attendDate = attendDate;
    config.attendSeatId = seatNumber;
    config.writeCookie();
    alert(`出席予約をしました。 ${attendDate.getHours()}時${attendDate.getMinutes()}分に出席されます。`);
}
function sendAttend(seatId) {
    const xmlHttpRequest = new XMLHttpRequest();
    xmlHttpRequest.onreadystatechange = function () {
        const READYSTATE_COMPLETED = 4;
        const HTTP_STATUS_OK = 200;
        if (this.readyState != READYSTATE_COMPLETED) {
            return;
        }
        if (this.status == HTTP_STATUS_OK) {
            location.reload();
        }
        else {
            alert(this.responseText);
        }
    };
    xmlHttpRequest.open('POST', 'https://service.cloud.teu.ac.jp/eye/request/attendance/update');
    xmlHttpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xmlHttpRequest.send("upload_data=%7B%22status%22%3A%22ATTENDING%22%2C%22seat_code%22%3A" + seatId + "%7D");
}
function insertReserveUI(config) {
    // TODO: 部屋番号も入力できるようにする。
    // 仮履修の場合は部屋番号の入力が必要。通常学期が始まってから1週間程度で仮履修状態は解除されるので優先度は低いが、いつか対応したい。
    const innerHtml = String.raw `<div class="l__columns">
        <section class="sec_web-attend l__item -full">
            <h2 class="c__ttl -tp1 e__ttl -md3 -sm3">出席の予約</h2>
                <div class="attend-form">
                    <div class="group">
                        <span class="label">座席コード</span>
						<input type="text" class="e__fld" placeholder="例: 9876" id="reserveSeatId">
                    </div>
                    <input type="button" class="btn-submit e__btn" value="予約" id="reserveButton">
                    <p class="e__prg -md2 -sm2">授業開始${config.attendGraceSec / 60}分前から予約ができます。必ず席に座った状態で入力してください。</p>
					<p class="e__prg -md2 -sm2" id="sendTime"></p>
            </h2>
        </section>
</div>`;
    const element = getElementByXpath(String.raw `//*[@id="top"]/div[1]/main/div`);
    element.insertAdjacentHTML("afterbegin", innerHtml);
}
function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
main();

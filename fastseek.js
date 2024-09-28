/*
 * This file contains Javascript code and utils for FastSeek
 * Written by gvl610
 */

// Cheat
// Yes I love Source engine's variables
var sv_cheats = false;

// Debug level
// 0: nothing will output
// 1: output some basic events
// 2: output events in loop
// 3: output variables or unneeded loop
const debuglvl = 0;

function LOG(lvl, msg) {
    if (debuglvl >= lvl) console.log(msg);
}

// Some global variables
var timerText, notiText, playButton, frame, manualInputDiv, manualInputField; // DOM
var ssu = new SpeechSynthesisUtterance();

// Max distance to be considered a win
var toleranceRange = 30;

// Game modes
// 0: Random mode (fetch random articles from Wikipedia)
// 1: Custom material (upload/paste)
var gameMode = 0;

var playing = false;
var playTimeSec = 0;
var startIdx = 0;
var currIdx = 0;
var fullText = "";
var orgText = "";
//var fullHTML = "";
var readingText = "";

// Init (if needed)
function setup(d1, d2, d3, d4, d5, d6) {
    // Store DOM
    timerText = d1;
    notiText = d2;
    playButton = d3;
    frame = d4;
    manualInputDiv = d5;
    manualInputField = d6;

    // Cancel previous SSU
    window.speechSynthesis.cancel();

    // Disable keyboard (no cheating pls :D)
    // Except for F5 key (refresh)
    window.addEventListener("keydown", (e) => {
        if (!sv_cheats) {
            // Only some keys are allowed
            if (e.keyCode !== 116 && e.keyCode !== 86 && !e.ctrlKey) {
                e.preventDefault();
            }
        }
    });

    // Register timer callback
    setInterval(timeCountCallback, 1000);

    LOG(1, "[INIT] Init done");
}

// Callback function for timer
function timeCountCallback() {
    if (playing) {
        LOG(3, "[TIMER] ++");
        playTimeSec++;
        min = Math.floor(playTimeSec / 60);
        sec = (playTimeSec % 60);
        timerText.innerText = min.toString() + ":" + (sec < 10 ? "0": "") + sec;
    }
}

// Reset game
function reset() {
    LOG(1, "[GAME] Reset");
    playTimeSec = 0;
    currIdx = 0;
    notiText.innerText = "You win!";
    notiText.style.display = "none";
    timerText.innerText = "00:00";
}

// Win event
function win() {
    playing = false;
    notiText.style.display = "block";
    window.speechSynthesis.cancel();
    alert("You win! It took you " + timerText.innerText + "!");
}

// Lose event
function lose() {
    // Refuse to play if page is not loaded
    if (frame.contentDocument.body.innerHTML === "") {
        alert("You resign even without trying. Come on!");
        return;
    }

    playing = false;
    notiText.style.display = "block";
    notiText.innerText = "You lose!";
    window.speechSynthesis.cancel();
    alert("You lose! You lost " + timerText.innerText + " of your life for nothing :( Try harder next time!");
}

// Play
function startGame() {
    // Refuse to play if page is not loaded
    if (frame.contentDocument.body.innerHTML === "") {
        alert("Randomize the article first!");
        return;
    }

    playing = true;

    // Randomly select a place to start reading
    startIdx = randomIntFromInterval(0, fullText.length * 0.9);
    LOG(1, "[GAME] startIdx = " + startIdx.toString());
    
    // Get reading text
    readingText = fullText.slice(startIdx);
    LOG(3, "[READ] " + readingText);

    // Start reading
    window.speechSynthesis.cancel();
    ssu.onboundary = onboundaryHandler;
    ssu.onend = onendHandler;
    ssu.text = readingText;
    window.speechSynthesis.speak(ssu);

    // Reset
    reset();

    // Add click event listener to iframe
    frame.contentDocument.body.removeEventListener('click', clickHandler, false);
    frame.contentDocument.body.addEventListener('click', clickHandler, false);
}

// Find first diff's position between 2 strings
function findFirstDiffPos(a, b) {
    var i = 0;
    if (a === b) return -1;
    while (a[i] === b[i]) i++;
    return i;
}

// Handle click event
function clickHandler() {
    LOG(3, "[SEL] Click detected!");
    // Stupid method for detecting if user's selected word is what currently being read:
    // Step 1: Get selection string inside iframe
    // Step 2: Remove that string from iframe
    // Step 3: Get innerText of iframe and restore the original text
    // Step 4: Compare newText with original innerText
    // Step 5: The first diff location is the selected location
    // Step 6: Compare with currIdx. If match, then you win!

    // Get selection inside iframe
    s = frame.contentDocument.getSelection();

    // Get selected string
    selectedString = s.anchorNode.data.slice(s.anchorOffset, s.focusOffset);
    LOG(2, "[SEL] Selected string: " + selectedString);
    if (selectedString.replaceAll(" ", "") == "") return; // We won't accept empty string!

    // Get the half before the selected string and the half after selected string
    firstHalf = s.anchorNode.data.slice(0, s.anchorOffset);
    secondHalf = s.anchorNode.data.slice(s.focusOffset);

    // Get original data
    fullText = frame.contentDocument.body.innerText;
    LOG(2, "[SEL] Original data: " + s.anchorNode.data);

    // To remove the selected stuff, we simple just replace anchorNode's innerText with firstHalf + secondHalf
    s.anchorNode.data = firstHalf + secondHalf;
    LOG(2, "[SEL] Replaced data: " + s.anchorNode.data);

    // Now get the iframe's innerText
    newText = frame.contentDocument.body.innerText;

    // Restore original text
    s.anchorNode.data = firstHalf + selectedString + secondHalf;
    //frame.contentDocument.body.innerHTML = fullHTML;
    LOG(2, "[SEL] Restored data: " + s.anchorNode.data);

    // Now compare new text with original text
    // The returned diffIdx is abs position (not position relative to startIdx)
    diffIdx = findFirstDiffPos(fullText, newText);
    LOG(1, "[SEL] diffIdx = " + diffIdx.toString());

    // Position is selected correctly if currIdx + startIdx = diffIdx
    // But we allow some tolerance range
    absCurrIdx = currIdx + startIdx;
    LOG(1, "[SEL] absCurrIdx = " + absCurrIdx.toString());
    if (Math.abs(absCurrIdx - diffIdx) <= toleranceRange) {
        // Player win!
        LOG(1, "[SEL] Win with tol = " + toleranceRange.toString());
        win();
    }
}

// Handle ssu boundary event
function onboundaryHandler(event) {
    currIdx = event.charIndex;
    LOG(3, "[CURR] currIdx = " + currIdx.toString());
}

// Handle ssu end event
function onendHandler(event) {
    LOG(1, "[GAME] Audio ended. You lose!");
    lose();
}

// Fetch new page
function fetchNewPage() {
    gameMode = 0;
    LOG(1, "[GAME] Fetching new page");

    // Close manual input field (if needed)
    if (manualInputDiv.style.display == "block") {
        manualInputDiv.style.display = "none";
        manualInputField.value = "";
    }

    // Reset
    reset();
    frame.src = "about:blank";

    fetch('https://en.wikipedia.org/api/rest_v1/page/random/html').then(v => {
        v.text().then(async content => {
            // Write HTML content to iframe
            frame.contentDocument.write(content);

            // Disable href (quick and dirty way, fix this if we can)
            frame.contentDocument.body.innerHTML = frame.contentDocument.body.innerHTML.replaceAll('href="', 'title="');

            // Remove all sup (which may causes problem with our comparing method)
            superscriptTags = frame.contentDocument.body.querySelectorAll('sup');
            superscriptTags.forEach(tag => {
                tag.parentNode.removeChild(tag);
            });

            // Extract text from the article
            fullText = frame.contentDocument.body.innerText;
            LOG(2, "[FULL_TEXT] " + fullText);
            //fullHTML = frame.contentDocument.body.innerHTML;

            // Click play button
            playButton.click();
        });
    });
}

// Generate random numbers
function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
    //return 0;
}

// Custom mode button handler
function customMode() {
    gameMode = 1;
    LOG(1, "[GAME] Enter custom mode");

    // Reset
    reset();
    frame.src = "about:blank";

    // Open input/upload field
    manualInputDiv.style.display = "block";
    manualInputField.value = "";
}

// Manual input done button handler
function manualInputDone() {
    LOG(1, "[MAN] Manual input text area done");

    // Close manual input area
    manualInputDiv.style.display = "none";

    // Reset
    reset();
    frame.src = "about:blank";

    // Write content to iframe
    frame.contentDocument.write(manualInputField.value);

    // Extract text from the article
    fullText = frame.contentDocument.body.innerText;
    LOG(2, "[FULL_TEXT] " + fullText);
    //fullHTML = frame.contentDocument.body.innerHTML;

    // Click play button
    playButton.click();
}

// Manual input clear button handler
function manualInputClear() {
    manualInputField.value = "";
    LOG(1, "[MAN] Manual input text area cleared");
}

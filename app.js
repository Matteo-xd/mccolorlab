let selectedStartBlock = null;
let selectedEndBlock = null;

document.addEventListener("DOMContentLoaded", () => {
    generateFullBlockDatabase();
    
    if (MINECRAFT_BLOCKS.length > 0) {
        // Sort items alphabetically from A-Z before rendering
        MINECRAFT_BLOCKS.sort((a, b) => a.name.localeCompare(b.name));

        document.getElementById("palette-count").textContent = MINECRAFT_BLOCKS.length;
        renderPalette(MINECRAFT_BLOCKS);
        initLengthSlider();
        initSearchBar();
        
        // Reset selections to default empty boundary
        document.getElementById("reset-selection-btn").addEventListener("click", clearSelections);
        
        // Set fallback preview text
        document.getElementById("gradient-result").innerHTML = "<p class='warning-msg' style='color: #666;'>Select Start and End blocks from the palette below to preview your gradient.</p>";
    }
    
    document.getElementById("generate-btn").addEventListener("click", generateBlockGradient);
});

function initLengthSlider() {
    const slider = document.getElementById("gradient-length");
    const label = document.getElementById("length-val");
    slider.addEventListener("input", () => { label.textContent = slider.value; });
}

function initSearchBar() {
    const searchBar = document.getElementById("search-bar");
    searchBar.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = MINECRAFT_BLOCKS.filter(b => b.name.toLowerCase().includes(query));
        renderPalette(filtered);
    });
}

function renderPalette(blocksArray) {
    const container = document.getElementById("block-container");
    container.innerHTML = ""; 
    
    if (blocksArray.length === 0) {
        container.innerHTML = "<p class='warning-msg'>No matching blocks found in 1.21.11 directory.</p>";
        return;
    }

    blocksArray.forEach(block => {
        const blockEl = document.createElement("div");
        blockEl.className = "block-card";
        blockEl.style.backgroundColor = block.hex;
        blockEl.style.backgroundImage = `url('${getBlockImageUrl(block.id)}')`;
        blockEl.style.backgroundSize = "cover";
        blockEl.style.imageRendering = "pixelated"; 
        blockEl.innerHTML = `<span>${block.name}</span>`;
        
        blockEl.addEventListener("click", () => {
            handleBlockClick(block);
        });
        
        container.appendChild(blockEl);
    });
}

function handleBlockClick(block) {
    if (!selectedStartBlock) {
        setSelection(block, "start");
    } else if (!selectedEndBlock) {
        setSelection(block, "end");
        generateBlockGradient();
    } else {
        setSelection(block, "end");
        generateBlockGradient();
    }
}

function setSelection(block, type) {
    if (type === "start") {
        selectedStartBlock = block;
        const slot = document.getElementById("preview-start");
        slot.classList.remove("empty");
        slot.querySelector(".slot-image").style.backgroundImage = `url('${getBlockImageUrl(block.id)}')`;
        slot.querySelector("span").textContent = `Start: ${block.name}`;
    } else {
        selectedEndBlock = block;
        const slot = document.getElementById("preview-end");
        slot.classList.remove("empty");
        slot.querySelector(".slot-image").style.backgroundImage = `url('${getBlockImageUrl(block.id)}')`;
        slot.querySelector("span").textContent = `End: ${block.name}`;
    }
}

function clearSelections() {
    selectedStartBlock = null;
    selectedEndBlock = null;
    
    const startSlot = document.getElementById("preview-start");
    startSlot.classList.add("empty");
    startSlot.querySelector(".slot-image").style.backgroundImage = "none";
    startSlot.querySelector("span").textContent = "Start: Select a block";

    const endSlot = document.getElementById("preview-end");
    endSlot.classList.add("empty");
    endSlot.querySelector(".slot-image").style.backgroundImage = "none";
    endSlot.querySelector("span").textContent = "End: Select a block";
    
    document.getElementById("gradient-result").innerHTML = "<p class='warning-msg' style='color: #666;'>Select Start and End blocks from the palette below to preview your gradient.</p>";
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// Added crash protection logic checking for invalid hex results
function findClosestBlock(targetRgb, excludedIds = []) {
    let closestBlock = null;
    let minDistance = Infinity;

    for (let i = 0; i < MINECRAFT_BLOCKS.length; i++) {
        const block = MINECRAFT_BLOCKS[i];
        if (excludedIds.includes(block.id)) continue;

        const blockRgb = hexToRgb(block.hex);
        if (!blockRgb) continue; // Skip corrupted registry items cleanly to prevent runtime loop crashes

        // Human eye weighted color distance matching calculation formula
        const rMean = (targetRgb.r + blockRgb.r) / 2;
        const r = targetRgb.r - blockRgb.r;
        const g = targetRgb.g - blockRgb.g;
        const b = targetRgb.b - blockRgb.b;
        
        const distance = Math.sqrt(
            (2 + rMean / 256) * r * r + 
            4 * g * g + 
            (2 + (255 - rMean) / 256) * b * b
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestBlock = block;
        }
    }

    return closestBlock || MINECRAFT_BLOCKS.find(b => !excludedIds.includes(b.id)) || MINECRAFT_BLOCKS[0];
}

function generateBlockGradient() {
    if (!selectedStartBlock || !selectedEndBlock) {
        document.getElementById("gradient-result").innerHTML = "<p class='warning-msg'>Please select both a Start and an End block first.</p>";
        return;
    }

    const resultContainer = document.getElementById("gradient-result");
    const noDuplicates = document.getElementById("no-duplicates").checked;
    const steps = parseInt(document.getElementById("gradient-length").value);
    
    resultContainer.innerHTML = ""; 

    const startRgb = hexToRgb(selectedStartBlock.hex);
    const endRgb = hexToRgb(selectedEndBlock.hex);

    let usedBlockIds = [];

    for (let i = 0; i < steps; i++) {
        let bestMatch;

        if (i === steps - 1) {
            bestMatch = selectedEndBlock; // End block is explicitly locked on the final step
        } else if (i === 0) {
            bestMatch = selectedStartBlock;
            usedBlockIds.push(bestMatch.id);
        } else {
            const t = i / (steps - 1);
            const currentRgb = {
                r: Math.round(startRgb.r + (endRgb.r - startRgb.r) * t),
                g: Math.round(startRgb.g + (endRgb.g - startRgb.g) * t),
                b: Math.round(startRgb.b + (endRgb.b - startRgb.b) * t)
            };

            bestMatch = findClosestBlock(currentRgb, noDuplicates ? usedBlockIds : []);
            
            if (noDuplicates) {
                usedBlockIds.push(bestMatch.id);
            }
        }

        const resultEl = document.createElement("div");
        resultEl.className = "gradient-block";
        resultEl.style.backgroundImage = `url('${getBlockImageUrl(bestMatch.id)}')`;
        resultEl.style.backgroundSize = "cover";
        resultEl.style.imageRendering = "pixelated";
        
        resultEl.innerHTML = `<strong>${bestMatch.name}</strong>`;
        resultContainer.appendChild(resultEl);
    }
}
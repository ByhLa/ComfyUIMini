const workflowTitle = document.body.getAttribute('data-workflow-title');

const inputsContainer = document.querySelector('.inputs-container');
const outputImagesContainer = document.querySelector('.output-images-container')

const totalImagesProgressInnerElem = document.querySelector('.total-images-progress .progress-bar-inner');
const totalImagesProgressTextElem = document.querySelector('.total-images-progress .progress-bar-text');
const currentImageProgressInnerElem = document.querySelector('.current-image-progress .progress-bar-inner');
const currentImageProgressTextElem = document.querySelector('.current-image-progress .progress-bar-text');

function loadWorkflow() {
    let currentWorkflow = "";
    const workflowTextAttrib = document.body.getAttribute('data-workflowtext');

    if (workflowTextAttrib !== "") { // Workflow sent by server aka pc-hosted
        currentWorkflow = JSON.parse(workflowTextAttrib);
    } else {
        currentWorkflow = getCurrentWorkflowJson();

        document.body.setAttribute('data-workflowtext', JSON.stringify(currentWorkflow));

        if (!currentWorkflow) {
            return;
        }
    }

    const workflowInputs = currentWorkflow["_comfyuimini_meta"].input_options;

    renderInputs(workflowInputs);
}

async function renderInputs(workflowInputs) {
    for (const inputJson of workflowInputs) {
        const inputHtml = await renderInput(inputJson);

        inputsContainer.innerHTML += inputHtml;
    }
}

function getCurrentWorkflowJson() {
    const allWorkflows = JSON.parse(localStorage.getItem('workflows')) || [];

    const allWorkflowTitles = allWorkflows.map((item) => JSON.parse(item)["_comfyuimini_meta"].title);

    if (!allWorkflowTitles.includes(workflowTitle)) {
        inputsContainer.textContent = `Workflow with name '${workflowTitle}' not found in localStorage.`;
        return null;
    }

    const currentWorkflow = JSON.parse(allWorkflows.filter((item) => JSON.parse(item)["_comfyuimini_meta"].title == workflowTitle)[0]);

    return currentWorkflow;
}

async function renderInput(inputOptions) {
    if (inputOptions.disabled) {
        return "";
    }

    let html = '';
    if (inputOptions.type === "select") {
        const modelListResponse = await fetch(`/comfyui/listmodels/${inputOptions.select_list}`);
        const modelListJson = await modelListResponse.json();

        html = `
        <div class="workflow-input-container">
            <label for="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}">${inputOptions.title}</label>
            <select id="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}" class="workflow-input">
        `;

        modelListJson.forEach(item => {
            html += `<option value="${item}">${item}</option>`;
        });

        html += "</select>"
    
    } else if (inputOptions.type === "text") {
        html = `
        <div class="workflow-input-container">
            <label for="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}">${inputOptions.title}</label>
            <textarea id="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}" class="workflow-input">${inputOptions.default}</textarea>
        `;
    } else {

        let type;

        switch (inputOptions.type) {
            case "integer":
                type = "number"
                break;
            case "float":
                type = "number"
                break;
            default:
                type = "text"
                break;
        }

        html = `
        <div class="workflow-input-container">
            <label for="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}">${inputOptions.title}</label>
            <div class="inner-input-wrapper">
                <input 
                    id="input-${inputOptions.node_id}-${inputOptions.input_name_in_node}" 
                    type="${type}" 
                    placeholder="${inputOptions.default}" 
                    class="workflow-input ${inputOptions.show_randomise_toggle ? "has-random-toggle" : ""}" 
                    value="${inputOptions.default}"
                    ${inputOptions.step !== undefined ? `step="${inputOptions.step}"` : ''}
                    ${inputOptions.min !== undefined ? `min="${inputOptions.min}"` : ''} 
                    ${inputOptions.max !== undefined ? `max="${inputOptions.max}"` : ''}
                >
        `;

        if (inputOptions.show_randomise_toggle) {
            html += `
            <button class="randomise-input" type="button" onclick="randomiseInput('input-${inputOptions.node_id}-${inputOptions.input_name_in_node}')">🎲</button>
            `;
        }

        html += `</div></div>`;
    }

    return html;
}

function randomiseInput(inputId) {
    //navigator.vibrate(10);
    // implement later with proper settings page
    const input = document.getElementById(inputId);

    const min = parseFloat(input.getAttribute('min'));
    const max = parseFloat(input.getAttribute('max'));
    const step = parseFloat(input.getAttribute('step')) || 1;

    let randomNumber;
    if (!isNaN(min) && !isNaN(max) && max > min) {
        const range = (max - min) / step;

        randomNumber = min + step * Math.floor(Math.random() * range);
        randomNumber = Math.min(randomNumber, max);
    } else {
        randomNumber = (Math.floor(Math.random() * 1e16)).toString().padStart(16, '0');
    }

    input.value = randomNumber;
}

function setProgressBar(type, percentage) {
    if (type == "total") {
        totalImagesProgressTextElem.textContent = percentage;
        totalImagesProgressInnerElem.style.width = percentage;
    } else if (type == "current") {
        currentImageProgressTextElem.textContent = percentage;
        currentImageProgressInnerElem.style.width = percentage;
    }
}

const ws = new WebSocket(`ws://${window.location.host}/ws`);

ws.onopen = () => {
    console.log("Connected to WebSocket client");
}

async function runWorkflow() {
    setProgressBar("current", "0%");
    setProgressBar("total", "0%");

    const workflow = JSON.parse(document.body.getAttribute('data-workflowtext'));

    // ComfyUI can't process the workflow if it contains the additional metadata.
    delete workflow["_comfyuimini_meta"];

    const allInputContainers = document.querySelectorAll('.workflow-input-container');

    for (const inputContainer of allInputContainers) {
        const inputElem = inputContainer.querySelector('.workflow-input');
        
        const [_, nodeId, nodeInputName] = inputElem.id.split('-');
        const inputValue = inputElem.value;

        workflow[nodeId].inputs[nodeInputName] = inputValue;
    }

    ws.send(JSON.stringify(workflow));

    let totalImageCount = 0;
    let completedImageCount = 0;
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'progress') {
            if (message.data.value === message.data.max) {
                completedImageCount += 1;

                const allImagesProgress = `${Math.round((completedImageCount / totalImageCount) * 100)}%`;

                setProgressBar("total", allImagesProgress);
            }

            const currentImageProgress = `${Math.round((message.data.value / message.data.max) * 100)}%`;

            setProgressBar("current", currentImageProgress);
        } else if (message.status === "total_images") {
            totalImageCount = message.data;

            if (totalImageCount !== undefined) {
                outputImagesContainer.innerHTML = `<div class="image-placeholder-skeleton"></div>`.repeat(totalImageCount);
            }
            
        } else if (message.status === 'completed') {
            // --- If using cached image and progress isnt set throughout generation
            setProgressBar("current", "100%");
            setProgressBar("total", "100%");
            // ---

            const allImagesJson = message.data;

            const allImageUrls = Object.values(allImagesJson).map((item) => {
                return item[0];
            });
            

            outputImagesContainer.innerHTML = "";

            for (const imageUrl of allImageUrls) {
                const imageHtml = urlToImageElem(imageUrl);

                outputImagesContainer.innerHTML += imageHtml;
            }

        } else if (message.status === 'error') {
            console.error('Error:', message.error);
        }
    };
}

function urlToImageElem(imageUrl) {
    return `<a href="${imageUrl}" target="_blank"><img src="${imageUrl}" class="output-image"></a>`;
}

loadWorkflow();
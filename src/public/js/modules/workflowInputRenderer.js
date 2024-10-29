import { inputRenderers } from './inputRenderers.js';

const inputsContainer = document.querySelector('.inputs-container');

const inputsInfoResponse = await fetch('/comfyui/inputsinfo');
const inputsInfoObject = await inputsInfoResponse.json();

/**
 *
 * @param {Object} workflowObject The workflow object to render inputs for.
 */
export function renderInputs(workflowObject) {
    for (const inputData of workflowObject['_comfyuimini_meta'].input_options) {
        const nodeInfo = workflowObject[inputData.node_id];
        const inputOptionsFromComfyUI = inputsInfoObject[nodeInfo.class_type]?.[inputData.input_name_in_node];

        if (!inputOptionsFromComfyUI) continue;

        for (const [inputName, inputDefaultFromWorkflow] of Object.entries(nodeInfo.inputs)) {
            if (inputData.input_name_in_node !== inputName || inputData.disabled) {
                continue;
            }
            const renderer = inputRenderers[inputOptionsFromComfyUI.type];

            if (!renderer) {
                throw new Error(`No renderer found for input type ${inputOptionsFromComfyUI.type}`);
            }

        let dataForRenderer = inputData;
        dataForRenderer = { ...dataForRenderer, ...inputOptionsFromComfyUI };
        dataForRenderer.default = inputDefaultFromWorkflow;

            const inputHtml = renderer(dataForRenderer);
            inputsContainer.innerHTML += inputHtml;
        }
    }
}

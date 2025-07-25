import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';

import './style.css';
import './css/visfault.css';

import Logo from './pic/BPMNinvest.png';
import FSULogo from './pic/Wortmarke_blue_5.png';

import $ from 'jquery';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import TokenSimulationModule from 'bpmn-js-token-simulation';
import TokenSimulationSupportModule from 'bpmn-js-token-simulation';
import { v4 as uuidv4 } from 'uuid';

import ModelExtractor from './modules/extractor.mjs';
import { SoundnessVerifier } from "./modules/soundness.mjs";
import { LoopDecomposition } from "./modules/loopdecomp.mjs";
import { SCC } from "./modules/scc.mjs";
import { Normalizer } from "./modules/normalize.mjs";
import { Visualizer } from "./modules/visualizer.mjs";

import emptyDiagramXML from './example/empty.bpmn';
import exampleDiagramXML from './example/example.bpmn';
import faultMasking from './example/fault-masking.bpmn';
import faultBlocking from './example/fault-blocking.bpmn';
import faultIllusion from './example/fault-illusion.bpmn';
import noVisualization from './example/no-visualization.bpmn';
import lackOfSynchronization from './example/lack-of-synchronization.bpmn';
import nonInterruptingBoundaryEvent from './example/non-interrupting-boundary-event.bpmn';
import wrongLoopEntry1 from './example/wrong-loop-entry-1.bpmn';
import wrongLoopEntry2 from './example/wrong-loop-entry-2.bpmn';
import deadlockDuringLoopInitialization from './example/deadlock-during-loop-initialization.bpmn';
import possibleEndlessLoop from './example/possible-endless-loop.bpmn';

import taskMerge from './example/bpmnanalyzer/implicit-task-merge.bpmn';
import showcase from './example/bpmnanalyzer/showcase.bpmn';
import reusedEndEvent from './example/bpmnanalyzer/reused-end-event.bpmn';
import stuck from './example/bpmnanalyzer/stuck.bpmn';
import deadActivity from './example/bpmnanalyzer/dead-activity.bpmn';
import poolsWithMessageFlows from './example/bpmnanalyzer/pools-with-message-flows.bpmn';
import cycles from './example/bpmnanalyzer/cyclic.bpmn';
import deadReceiveTask from './example/bpmnanalyzer/dead-receive-task.bpmn';
import deadMice from './example/bpmnanalyzer/dead-mice.bpmn';
import starvation from './example/bpmnanalyzer/starvation.bpmn';
import livelock from './example/bpmnanalyzer/livelock.bpmn';
import deadTasksConnected from './example/bpmnanalyzer/dead_tasks_connected.bpmn';
import orderHandling from './example/bpmnanalyzer/order_handling.bpmn';

import { faultBus } from "./modules/faultbus.mjs";
import {ToggleOffIcon, ToggleOnIcon} from "bpmn-js-token-simulation/lib/icons/index.js";


// Create a container where files can be dropped on to be opened.
let container = $('#js-drop-zone');

// Create a new BPMN modeler based on bpmn.io
let modeler = new BpmnModeler({
    container: '#js-canvas',
    additionalModules: [
        TokenSimulationModule,
        TokenSimulationSupportModule
    ]
});

// Get the event bus to start the soundness checking on each change of the model.
let eventBus = modeler.get('eventBus');

// Each soundness checking routine has a visualizer highlighting the errors in the model.
// If there is any change, the last visualizer has to be destructed.
let lastVisualizer = null;

let enabledAnalysis = true;

// The function to start analyzing soundness.
let analyzeSoundness = (function() {
    return async function() {
        const startTime = performance.now()
        // Initialize the visualizer
        if (lastVisualizer !== null) lastVisualizer.destruct();
        lastVisualizer = Visualizer();
        lastVisualizer.initialize(modeler, faultBus);
        let extractor = ModelExtractor();
        let model = extractor.extractDiagram(modeler);
        const startAnalysisTime = performance.now()
        SoundnessVerifier().check(
            LoopDecomposition().decompose(
                SCC().findSCCs(
                    Normalizer.normalize(model)
                )
            )
        );
        const endAnalysisTime = performance.now()
        const endTime = performance.now()
        console.log('BPMNinvest, time for analysis:', (endAnalysisTime - startAnalysisTime) + ' [ms]');
        console.log('BPMNinvest, complete time:', (endTime - startTime) + ' [ms]');
    };
})();

// Register the soundness analysis on any change of the model.
eventBus.on('elements.changed', function(context) {
    try {
        if (enabledAnalysis) analyzeSoundness();
    } catch (exception) {
        console.error(exception);
    }
});

/**
 * Create a new diagram with new UUIDs.
 */
function createNewDiagram() {
    let processId = uuidv4();
    let diagramId = uuidv4();
    let planeId = uuidv4();
    let xml = emptyDiagramXML.replaceAll('ProcessPlaceHolder', processId);
    xml = xml.replaceAll('DiagramPlaceHolder', diagramId);
    xml = xml.replaceAll('PlanePlaceHolder', planeId);
    openDiagram(xml);
}

/**
 * Open a BPMN model (diagram).
 * @param xml A string containing XML code.
 * @returns {Promise<void>}
 */
async function openDiagram(xml) {
    if (lastVisualizer !== null) lastVisualizer.destruct();
    lastVisualizer = null;
    faultBus.clear();
    try {
        await modeler.importXML(xml);
        if (enabledAnalysis) analyzeSoundness();

        container
            .removeClass('with-error')
            .addClass('with-diagram');
    } catch (err) {
        container
            .removeClass('with-diagram')
            .addClass('with-error');
        container.find('.error pre').text(err.message);

        console.error(err);
    }
}

/**
 * Read a file (with the BPMN model).
 * @param file The file.
 * @param callback A callback function getting the read XML code.
 */
function readFile(file, callback) {
    let reader = new FileReader();
    reader.onload = function (e) {
        let xml = e.target.result;
        callback(xml);
    };
    reader.readAsText(file);
}

const fileInput = document.createElement("input");
fileInput.setAttribute("type", "file");
fileInput.style.display = "none";
document.body.appendChild(fileInput);
fileInput.addEventListener("change", function (e) {
    readFile(e.target.files[0], openDiagram);
});

/**
 * Register file opening functionality if a file is dropped at the surface.
 * @param container The container on which the file drop shall be allowed.
 * @param callback The callback function that shall handle the dropped file (if any).
 */
function registerFileDrop(container, callback) {

    function handleFileSelect(e) {
        e.stopPropagation();
        e.preventDefault();

        let files = e.dataTransfer.files;
        let file = files[0];
        readFile(file, callback);
    }

    function handleDragOver(e) {
        e.stopPropagation();
        e.preventDefault();

        e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    }

    container.get(0).addEventListener('dragover', handleDragOver, false);
    container.get(0).addEventListener('drop', handleFileSelect, false);
}


// file drag / drop ///////////////////////

// check file api availability
if (!window.FileList || !window.FileReader) {
    window.alert(
        'Looks like you use an older browser that does not support drag and drop. ' +
        'Try using Chrome, Firefox or the Internet Explorer > 10.');
} else {
    registerFileDrop(container, openDiagram);
}

// bootstrap diagram functions

$(function () {

    $('#js-create-diagram').click(function (e) {
        e.stopPropagation();
        e.preventDefault();

        createNewDiagram();
    });

    let downloadLink = $('#js-download-diagram');
    let downloadSvgLink = $('#js-download-svg');
    let openFile = $('#js-open-diagram');
    let newBPMN = $('#js-new-diagram');
    let exampleSelector = $('#examples-opener');
    let logo = $('#BPMNinvest-logo');
    let fsuLogo = $('#fsu-logo');
    let enableAnalysis = $('.enable-analysis');

    $('.buttons a').click(function (e) {
        if (!$(this).is('.active')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    function setEncoded(link, name, data) {
        let encodedData = encodeURIComponent(data);

        if (data) {
            link.addClass('active').attr({
                'href': 'data:application/bpmn20-xml;charset=UTF-8,' + encodedData,
                'download': name
            });
        } else {
            link.removeClass('active');
        }
    }

    let exportArtifacts = debounce(async function () {
        try {
            const {svg} = await modeler.saveSVG();
            setEncoded(downloadSvgLink, 'diagram.svg', svg);
        } catch (err) {
            console.error('Error happened saving svg: ', err);
            setEncoded(downloadSvgLink, 'diagram.svg', null);
        }

        try {
            const {xml} = await modeler.saveXML({format: true});
            setEncoded(downloadLink, 'diagram.bpmn', xml);
        } catch (err) {

            console.error('Error happened saving XML: ', err);
            setEncoded(downloadLink, 'diagram.bpmn', null);
        }
    }, 500);

    modeler.on('commandStack.changed', exportArtifacts);

    // Add merch logos.
    logo.append($('<img src="' + Logo + '" alt="Logo of BPMNinvest showing a magnifier">'));
    fsuLogo.append($('<img src="' + FSULogo + '" alt="Logo of the Friedrich Schiller University Jena, Germany">'));

    // Add the enable/disable analysis toggle.
    enableAnalysis.append($('<div class="bts-toggle-mode active">Analysis <span class="bts-toggle"><span class="bts-icon ">' + ToggleOnIcon() + '</span></span></div>'));
    enableAnalysis.on('click', function () {
        enabledAnalysis = !enabledAnalysis;
        if (enabledAnalysis) {
            $('.enable-analysis > .bts-toggle-mode')
                .addClass('active')
                .html('Analysis <span class="bts-toggle"><span class="bts-icon ">' + ToggleOnIcon() + '</span></span>');
            $('.analysis').show();
            analyzeSoundness();
        } else {
            $('.enable-analysis > .bts-toggle-mode')
                .removeClass('active')
                .html('Analysis <span class="bts-toggle"><span class="bts-icon ">' + ToggleOffIcon() + '</span></span>');
            $('.analysis').hide();
            if (lastVisualizer !== null) lastVisualizer.destruct();
        }
    });

    // Add functionality for the "BPMN file" button.
    openFile.on('click', function () {
        fileInput.value = "";
        fileInput.click();
    });

    // Add functionality for the "new diagram" button.
    newBPMN.on('click', function (e) {
        e.stopPropagation();
        e.preventDefault();

        createNewDiagram();
    });
    // Add the examples in a drop-down.
    exampleSelector.on('change', function (e) {
        switch ($(this).val()) {
            case 'example.bpmn': {
                openDiagram(exampleDiagramXML);
            } break;
            case "fault-masking.bpmn": {
                openDiagram(faultMasking);
            } break;
            case "fault-blocking.bpmn": {
                openDiagram(faultBlocking);
            } break;
            case "fault-illusion.bpmn": {
                openDiagram(faultIllusion);
            } break;
            case "no-visualization.bpmn": {
                openDiagram(noVisualization);
            } break;
            case "lack-of-synchronization.bpmn": {
                openDiagram(lackOfSynchronization);
            } break;
            case "non-interrupting-boundary-event.bpmn": {
                openDiagram(nonInterruptingBoundaryEvent);
            } break;
            case "wrong-loop-entry-1.bpmn": {
                openDiagram(wrongLoopEntry1);
            } break;
            case "wrong-loop-entry-2.bpmn": {
                openDiagram(wrongLoopEntry2);
            } break;
            case "deadlock-during-loop-initialization.bpmn": {
                openDiagram(deadlockDuringLoopInitialization);
            } break;
            case "possible-endless-loop.bpmn": {
                openDiagram(possibleEndlessLoop);
            } break;
            case "implicit-task-merge.bpmn": {
                openDiagram(taskMerge);
            } break;
            case "showcase.bpmn": {
                openDiagram(showcase);
            } break;
            case "reused-end-event.bpmn": {
                openDiagram(reusedEndEvent);
            } break;
            case "stuck.bpmn": {
                openDiagram(stuck);
            } break;
            case "dead-activity.bpmn": {
                openDiagram(deadActivity);
            } break;
            case "pools-with-message-flows.bpmn": {
                openDiagram(poolsWithMessageFlows);
            } break;
            case "cyclic.bpmn": {
                openDiagram(cycles);
            } break;
            case "dead-receive-task.bpmn": {
                openDiagram(deadReceiveTask);
            } break;
            case "dead-mice.bpmn": {
                openDiagram(deadMice);
            } break;
            case "starvation.bpmn": {
                openDiagram(starvation);
            } break;
            case "livelock.bpmn": {
                openDiagram(livelock);
            } break;
            case "dead_tasks_connected.bpmn": {
                openDiagram(deadTasksConnected);
            } break;
            case "order_handling.bpmn": {
                openDiagram(orderHandling);
            } break;
        }
    });
});


// helpers //////////////////////

function debounce(fn, timeout) {

    let timer;

    return function () {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(fn, timeout);
    };
}
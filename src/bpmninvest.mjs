import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';

import './style.css';
import './css/visfault.css';

import $ from 'jquery';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import TokenSimulationModule from 'bpmn-js-token-simulation';
import TokenSimulationSupportModule from 'bpmn-js-token-simulation';

import ModelExtractor from './modules/extractor.mjs';
import { SoundnessVerifier } from "./modules/soundness.mjs";
import { LoopDecomposition } from "./modules/loopdecomp.mjs";
import { SCC } from "./modules/scc.mjs";
import { Normalizer } from "./modules/normalize.mjs";
import { Visualizer } from "./modules/visualizer.mjs";

import diagramXML from './example/example.bpmn';
import { faultBus } from "./modules/faultbus.mjs";



var container = $('#js-drop-zone');

var modeler = new BpmnModeler({
    container: '#js-canvas',
    additionalModules: [
        TokenSimulationModule,
        TokenSimulationSupportModule
    ]
});

let eventBus = modeler.get('eventBus');

let analyzeSoundness = (function() {
    let vis = null;
    return async function() {
        // Initialize the visualizer
        if (vis !== null) vis.destruct();
        vis = Visualizer();
        vis.initialize(modeler, faultBus);
        let extractor = ModelExtractor();
        let model = extractor.extractDiagram(modeler);
        SoundnessVerifier().check(
            LoopDecomposition().decompose(
                SCC().findSCCs(
                    Normalizer.normalize(model)
                )
            )
        );
    };
})();

eventBus.on('elements.changed', function(context) {
    try {
        analyzeSoundness();
    } catch (exception) {
        console.error(exception);
    }
});

function createNewDiagram() {
    openDiagram(diagramXML);
}

async function openDiagram(xml) {

    try {

        await modeler.importXML(xml);
        analyzeSoundness();

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

function registerFileDrop(container, callback) {

    function handleFileSelect(e) {
        e.stopPropagation();
        e.preventDefault();

        var files = e.dataTransfer.files;

        var file = files[0];

        var reader = new FileReader();

        reader.onload = function (e) {

            var xml = e.target.result;

            callback(xml);
        };

        reader.readAsText(file);
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

    var downloadLink = $('#js-download-diagram');
    var downloadSvgLink = $('#js-download-svg');

    $('.buttons a').click(function (e) {
        if (!$(this).is('.active')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    function setEncoded(link, name, data) {
        var encodedData = encodeURIComponent(data);

        if (data) {
            link.addClass('active').attr({
                'href': 'data:application/bpmn20-xml;charset=UTF-8,' + encodedData,
                'download': name
            });
        } else {
            link.removeClass('active');
        }
    }

    var exportArtifacts = debounce(async function () {

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
});


// helpers //////////////////////

function debounce(fn, timeout) {

    var timer;

    return function () {
        if (timer) {
            clearTimeout(timer);
        }

        timer = setTimeout(fn, timeout);
    };
}
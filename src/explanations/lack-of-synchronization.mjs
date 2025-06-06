import { GatewayType } from "../modules/model.mjs";
import {asList} from "../modules/settools.mjs";
import $ from "jquery";
import {TokenSimulationHandling} from "../modules/simsupport.mjs";
import {flatten} from "array-flatten";

let explanation = function (panel, information, modeler) {

    let isParallelStart = false;
    let diverging = information.split;
    let divergingIds = diverging.elementIds;
    let converging = information.intersectionPoint;
    let convergingIds = converging.elementIds;

    panel.append('<h1>Missing Synchronization leads to Unexpected Behavior</h1>');

    panel.append('<h2>Explanation</h2>');
    panel.append('<p>Diverging parallel and inclusive gateways (may) result in concurrent control flows executing ' +
        'the tasks interwoven. Such concurrent control flows should be synchronized correctly or should terminate in ' +
        'separated end events to avoid undesired behavior of the process model.</p>');
    panel.append('<p>An improper synchronization is possible if two paths starting in different outgoing flows of a ' +
        'diverging parallel or inclusive gateway can firstly meet in a converging exclusive gateway. In this case, ' +
        'the exclusive gateway is executed twice (once for each control flow) and all following tasks are executed ' +
        'twice as well.</p>');


    panel.append('<h2>Flaw in your process model</h2>');

    if (!isParallelStart) {
        panel.append('<p>Your process model contains the ' +
            '<a data-element-link=\'' + JSON.stringify(asList(divergingIds)) + '\'>diverging ' +
            (diverging.getKind === GatewayType.AND ? 'parallel' : 'inclusive') + ' gateway</a> that is not ' +
            'synchronized successfully in a ' +
            '<a data-element-link=\'' + JSON.stringify(asList(convergingIds)) + '\'>converging exclusive ' +
            ' gateway</a>.</p>');
    }
    panel.append('<p>Starting in the pulsating and the strong black lined elements, there are two disjoint paths to ' +
        '<a data-element-link=\'' + JSON.stringify(asList(convergingIds)) + '\'>converging exclusive ' + ' gateway</a>. ' +
        'Via those paths, two concurrent control flows may reach the gateway and cause undesired behavior subsequently.' +
        '</p>');

    panel.append('<h2>Proposals for repairment</h2>');
    panel.append('<p>If the concurrency is desired, you should think about the strong black lined paths whether they ' +
        'are represent your process model correctly. One solution may be to converge the concurrent control flows earlier' +
        'in your process model.</p>')
    panel.append('<p>If your workflow management system allows for using inclusive gateways, another solution is to ' +
        'replace the ' +
        '<a data-element-link=\'' + JSON.stringify(asList(convergingIds)) + '\'>converging exclusive ' + ' gateway</a> ' +
        'with a converging inclusive gateway.');


    panel.append('<h2>Simulation (Experimental)</h2>');
    panel.append('<p>You can execute your process model and a simulation tries to cause the undesired behavior in ' +
        'your process model. <strong>The flaw is not guaranteed to happen.</strong> This does not mean that your process ' +
        'model does not contain the flaw. This just means that:</p>');
    panel.append('<ol>' +
        '<li>a previous flaw hinders the current one (e.g., a deadlock),</li>' +
        '<li>a previous flaw cover the current one, or</li>' +
        '<li>the simulator is unable yet to reproduce the flaw.</li></ol>');
    panel.append('<p>Using the simulation is experimental and will be further revised.</p>');
    let simButton = $('<button id="startSimulation">Start simulation</button>');
    panel.append(simButton);

    let message = $('<div class="simulation-hint"></div>');
    panel.append(message);


    panel.append('<h2>References:</h2>');
    panel.append('<blockquote>' +
        'Thomas M. Prinz, Wolfram Amme:<br>' +
        '<a href="https://doi.org/10.7250/csimq.2021-27.01" target="_blank">Control-Flow-Based Methods to Support the Development of Sound Workflows.</a><br>' +
        'Complex Syst. Informatics Model. Q. 27: 1-44 (2021)' +
        '</blockquote>');
    panel.append('<blockquote>' +
        'C&#233;dric Favre, Hagen V&ouml;lzer:<br>' +
        '<a href="https://doi.org/10.1007/978-3-642-15618-2_19" target="_blank">Symbolic Execution of Acyclic Workflow Graphs.</a><br>' +
        'BPM 2010: 260-275' +
        '</blockquote>');

    // Token simulation
    let simInformation = information.simulation;
    console.log(simInformation);

    let simHandler = TokenSimulationHandling(modeler);
    simHandler.start();

    let pathToSplit = simInformation.pathToSplit;
    simHandler.setDecisions(pathToSplit);

    // Set decisions for the paths to the sync node:
    let pathsToSync = simInformation.pathsToSync;
    asList(pathsToSync).forEach(path => {
        simHandler.setDecisions(path);
    });
    simHandler.pauseIfExited(simInformation.sync, (node) => {
        message.append('<p>From this moment, there is an additional token that arrives at the exclusive gateway.</p>');
    });

    simButton.on('click', function () {
        simHandler.controlElement(pathToSplit[0]);
        $('.simulation-hint').empty();
    });
};

export { explanation };
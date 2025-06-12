import { GatewayType } from "../modules/model.mjs";
import {asList, asObject} from "../modules/settools.mjs";
import $ from "jquery";
import {TokenSimulationHandling} from "../modules/simsupport.mjs";
import {flatten} from "array-flatten";
import {PathFinderFactory} from "../modules/pathfinder.mjs";

let explanation = function (panel, information, modeler) {

    let diverging = information.split;
    let isParallelStart = diverging.isDivergingStart;
    let converging = information.intersectionPoint;

    let pathFinder = PathFinderFactory(modeler);
    let divergingProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ diverging ])).concat([]);
    divergingProcessElement = divergingProcessElement.shift();
    let convergingProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ converging ])).concat([]);
    convergingProcessElement = convergingProcessElement.shift();

    panel.append('<h1>Missing Synchronization leads to Unexpected Behavior</h1>');

    panel.append('<h2>Explanation</h2>');
    panel.append('<p>Diverging parallel and inclusive gateways (may) result in concurrent control flows executing ' +
        'the tasks interwoven. Such concurrent control flows should be synchronized correctly or should terminate in ' +
        'separated end events to avoid undesired behavior of the process model.</p>');
    panel.append('<p>An improper synchronization is possible if two paths starting in different outgoing flows of a ' +
        'diverging parallel or inclusive gateway can firstly meet in a converging exclusive gateway. In this case, ' +
        'the exclusive gateway is executed twice (once for each control flow) and all following tasks are executed ' +
        'twice as well.</p>');
    panel.append('<p>In general, such an improper synchronization hinders a proper completion of a process model and, ' +
        'sometimes, the option to complete - both considered as bad practice.')


    panel.append('<h2>Flaw in your process model</h2>');

    let joinType = convergingProcessElement.type.substring(5);
    let joinLink = '<a data-element-link=\'' + JSON.stringify(asList(converging.elementIds)) + '\'>' + joinType  + '</a>';
    let joinImplicitExplicit = joinType.includes('Gateway') ? '' : 'n implicit';

    if (!isParallelStart) {
        let splitType = divergingProcessElement.type.substring(5);
        let splitLink = '<a data-element-link=\'' + JSON.stringify(asList(diverging.elementIds)) + '\'>' + splitType  + '</a>';
        let implicitExplicit = splitType.includes('Gateway') ? '' : 'n implicit';
        let parallelInclusive = (diverging.getKind === GatewayType.AND ? 'parallel' : 'inclusive');

        panel.append('<p>You have used a' + implicitExplicit + ' diverging ' + parallelInclusive + ' gateway, a ' +
            splitLink + ' in your model, that is not sychronized successfully in a' + joinImplicitExplicit + ' ' +
            'exclusive gateway, a ' + joinLink + ' in your model.</p>');
    } else {
        panel.append('<p>Your process model uses an implicit start event that causes concurrent control flows that are ' +
            'not sychronized successfully in a' + joinImplicitExplicit + ' ' +
            'exclusive gateway, a ' + joinLink + ' in your model.</p>');
    }
    panel.append('<p>Starting in the pulsating and the strong black lined elements, there are two disjoint paths to ' +
        joinLink + '. ' +
        'Via those paths, two concurrent control flows may reach the gateway and cause undesired behavior subsequently.' +
        '</p>');

    panel.append('<h2>Proposals for repairment</h2>');
    panel.append('<p>If the concurrency is desired, you should think about the strong black lined paths whether they ' +
        'represent your process model correctly. One solution may be to converge the concurrent control flows earlier' +
        'in your process model.</p>')
    panel.append('<p>If your workflow management system allows for using inclusive gateways, another solution is to ' +
        'replace the ' + joinLink + ' with a converging inclusive gateway.');


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
    panel.append('<blockquote>' +
        'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
        '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
        'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
        '</blockquote>');

    // Token simulation
    let simInformation = information.simulation;

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
        message.append('<p>From this moment, there is an additional token that arrives at the ' + joinLink + '.</p>');
    });

    simButton.on('click', function () {
        simHandler.controlElement(pathToSplit[0]);
        $('.simulation-hint').empty();
    });

    return () => { simHandler.stop(); };
};

export { explanation };
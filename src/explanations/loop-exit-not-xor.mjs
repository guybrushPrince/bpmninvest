import { GatewayType } from "../modules/model.mjs";
import $ from 'jquery';
import { asList, asObject } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";

let explanation = function (panel, information, modeler, process) {
    let loopExit = information.exit;
    let pathFinder = PathFinderFactory(modeler);
    let exitProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ loopExit ])).concat([]);
    exitProcessElement = exitProcessElement.shift();

    panel.append('<h1>Loop has a Loop Exit that is not an Exclusive Gateway</h1>');

    panel.append('<h2>Explanation</h2>');
    panel.append('<p><em>Loops</em> are cyclic structures in a process model, in which each node has a path to each ' +
        'other node of the loop (called <em>strongly connected component</em>, SCC). ' +
        'Usually, loops can be entered at some nodes, the <em>loop entries</em>, and can be left at some nodes, ' +
        'the <em>loop exits</em>. Therefore, loop entries and exits are <em>gateways</em>.</p>');
    panel.append('<p>Research and best practice has shown that loop exits that are <em>inclusive</em> or ' +
        '<em>parallel</em> gateways lead to unexpected behavior in process models. ' +
        'Both kinds of gateways (may) result in concurrent control flows. At least one of those control flows ' +
        'will execute nodes outside the loop. By the definition of a loop, control flows out of a loop cannot turn ' +
        'back. As a result, it is not possible to synchronize the concurrent control flows successfully. The ' +
        '<em>option to complete</em> and a <em>proper completion</em> are uncertain as well as a the absence of ' +
        'deadlocks.</p>');


    let type = exitProcessElement.type.substring(5);
    let exitLink = '<a data-element-link=\'' + JSON.stringify(asList(loopExit.elementIds)) + '\'>' + type  + '</a>';
    let exitImplicitExplicit = type.includes('Gateway') ? '' : 'n implicit';
    let inclusiveParallel = loopExit.getKind === GatewayType.AND ? 'parallel' : 'inclusive';

    panel.append('<h2>Flaw in your process model</h2>');
    panel.append('<p>The loop being visualized by strong lined elements in the editor has a <em>loop exit</em> as ' +
        'a' + exitImplicitExplicit + ' ' + inclusiveParallel + ' gateway being ' + exitLink + ' in your process ' +
        'model.</p>');
    panel.append('<p>The pulsating lines illustrate the flows that are going out of the loop. ' +
        'Since the loop exit may produce parallel control flows, the pulsating flows ' +
        'may get control flows in each iteration of the loop. These parallel control flows cannot be successfully ' +
        'synchronized subsequently.' +
        '</p>');

    panel.append('<h2>Proposals for repairment</h2>');
    panel.append('<p>If possible, replace the loop exit with an exclusive gateway and check subsequently if your ' +
        'process model still has the desired behavior.</p>');

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
        'Thomas M. Prinz, Yongsun Choi, N. Long Ha:<br>' +
        '<a href="https://doi.org/10.1016/j.is.2024.102476" target="_blank">Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.</a><br>' +
        'Inf. Syst. 128: 102476 (2025)' +
        '</blockquote>');
    panel.append('<blockquote>' +
        'Jussi Vanhatalo, Hagen V&ouml;lzer, Frank Leymann:<br>' +
        '<a href="https://doi.org/10.1007/978-3-540-74974-5_4" target="_blank">Faster and More Focused Control-Flow Analysis for Business Process Models Through SESE Decomposition.</a><br>' +
        'ICSOC 2007: 43-55' +
        '</blockquote>');
    panel.append('<blockquote>' +
        'Yongsun Choi, Pauline Kongsuwan, Cheol Min Joo, J. Leon Zhao:<br>' +
        '<a href="https://doi.org/10.1016/j.datak.2014.11.003" target="_blank">Stepwise structural verification of cyclic workflow models with acyclic decomposition and reduction of loops.</a><br>' +
        'Data Knowl. Eng. 95: 39-65 (2015)' +
        '</blockquote>');
    panel.append('<blockquote>' +
        'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
        '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
        'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
        '</blockquote>');


    // Token simulation
    let simInformation = information.simulation;

    let exit = simInformation.exit;
    let pathToExit = simInformation.pathToExit;

    let simHandler = TokenSimulationHandling(modeler);
    simHandler.start();

    simHandler.setDecisions(pathToExit);

    simHandler.pauseIfExited(exit, (node) => {
        message.append('<p>Starting from this situation, the token on the outgoing flow of the loop can never get back ' +
            'into the loop.</p>');
    });
    if (exit.getKind === GatewayType.OR) {
        asList(exit.getOutgoing).forEach(f => simHandler.setDecision(exit, f));
    }

    simButton.on('click', function () {
        simHandler.controlElement(pathToExit[0]);
        $('.simulation-hint').empty();
    });

    return () => { simHandler.stop(); };
};

export { explanation };
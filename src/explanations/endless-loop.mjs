import { VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import { GatewayType } from "../modules/model.mjs";
import { asList, asObject, union } from "../modules/settools.mjs";
import $ from "jquery";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";

const POTENTIAL_ENDLESS_LOOP = 'Possible endless loop';

let visualizerModule = new VisualizerModule(
    FaultType.POTENTIAL_ENDLESS_LOOP,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let intersectionPoint = elements.intersectionPoint;
        let split = elements.split;
        let postset = elements.postset;
        visualizer.addErrorLine(split.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(split.getUI$, type, POTENTIAL_ENDLESS_LOOP, (panel) => {
            visualizer.fadeOut();
            intersectionPoint = asObject([ intersectionPoint ]);
            let causesUI = visualizer.mapToUI(union(intersectionPoint, postset));
            split = asObject([ split] );
            let nonFade = visualizer.mapToUI(union(split, union(process.getNodes, process.getEdges)));
            visualizer.setFocus(causesUI, nonFade);

            closerAction = this.getExplanation(panel, elements, modeler);
        }, () => { closerAction(); });
    },
    function (panel, information, modeler) {
        let diverging = information.split;
        let isParallelStart = diverging.isDivergingStart;
        let converging = information.intersectionPoint;

        let pathFinder = PathFinderFactory(modeler);
        let divergingProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ diverging ])).concat([]);
        divergingProcessElement = divergingProcessElement.shift();
        let convergingProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ converging ])).concat([]);
        convergingProcessElement = convergingProcessElement.shift();

        panel.append('<h1>Endless Loop because of Missing Synchronization</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p>Diverging parallel and inclusive gateways (may) result in concurrent control flows executing ' +
            'the tasks interwoven. Such concurrent control flows should be synchronized correctly or should terminate in ' +
            'separated end events to avoid undesired behavior of the process model.</p>');
        panel.append('<p><em>Loops</em> are cyclic structures in a process model, in which each node has a path to each ' +
            'other node of the loop (called <em>strongly connected component</em>, SCC). ' +
            'Usually, loops can be left at some nodes, the <em>loop exits</em>. Therefore, loop exits are ' +
            '<em>gateways</em>.</p>');
        panel.append('<p><em>Endless loops</em> may occur in at least one instance of a process model if a ' +
            'diverging parallel or inclusive gateway in a loop has no converging point collecting all concurrent ' +
            'control flows before any control flow reaches one of the loop exits of a loop. In such a case, the ' +
            'control flow may leave the loop whereas, at the same moment, there is at least one control flow remaining ' +
            'in the loop. Both control flows cannot be successfully synchronized in all cases leading to unexpected ' +
            'behavior of the process model.' + '</p>');


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
                splitLink + ' in your model, that is not sychronized successfully in the loop, which is highlighted by ' +
                'strong black lines in your process model.</p>');
        } else {
            panel.append('<p>Your process model uses an implicit start event that causes concurrent control flows that are ' +
                'not sychronized successfully in the loop, which is highlighted by ' +
                'strong black lines in your process model.</p>');
        }
        panel.append('<p>The pulsating outgoing flows of the gateway illustrate the starting points of concurrent ' +
            'control flows, which do not have a converging gateway before the loop exit, which is a' + joinImplicitExplicit
            + ' ' + joinLink + ' in your process model.</p>');

        panel.append('<p>Starting in the pulsating and the strong black lined elements, there are two disjoint paths to ' +
            joinLink + '. ' + 'Via those paths, two concurrent control flows may reach the loop exit and cause undesired ' +
            'behavior subsequently.' + '</p>');


        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>If the concurrency is desired, please converge them before reaching the loop exit ' +
            joinLink + '.</p>');


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
            'Thomas M. Prinz, Wolfram Amme:<br>' +
            '<a href="https://doi.org/10.7250/csimq.2021-27.01" target="_blank">Control-Flow-Based Methods to Support the Development of Sound Workflows.</a><br>' +
            'Complex Syst. Informatics Model. Q. 27: 1-44 (2021)' +
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
        simHandler.pauseIfExited(simInformation.split, (node) => {
            message.append('<p>From this moment, there is an additional token that arrives at the ' + joinLink + '.</p>');
        });

        simButton.on('click', function () {
            simHandler.controlElement(pathToSplit[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };
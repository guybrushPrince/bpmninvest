import { VisualizerModule } from "../modules/visualizer.mjs";
import { FaultType, FaultLevel } from "../modules/faultbus.mjs";
import { GatewayType } from "../modules/model.mjs";
import { asList, asObject, union } from "../modules/settools.mjs";
import $ from "jquery";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";

const LIVE_LOCK = 'Endless loop';

let visualizerModule = new VisualizerModule(
    FaultType.LIVE_LOCK,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let loopModel = elements.loop;
        let entry = elements.refEntry;
        visualizer.addErrorLine(entry.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(entry.getUI$, type, LIVE_LOCK, (panel) => {
            visualizer.setFocus(entry.getUI$, visualizer.mapToUI(union(loopModel.getNodes, loopModel.getEdges)));

            closerAction = this.getExplanation(panel, elements, modeler);
        }, () => { closerAction(); });
    },
    function (panel, information, modeler) {
        let entry = information.refEntry;
        let pathFinder = PathFinderFactory(modeler);
        let entryProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ entry ])).concat([]);
        entryProcessElement = entryProcessElement.shift();

        panel.append('<h1>Live Lock</h1>');

        panel.append('<h2>Explanation</h2>');
        panel.append('<p><em>Loops</em> are cyclic structures in a process model, in which each node has a path to each ' +
            'other node of the loop (called <em>strongly connected component</em>, SCC). ' +
            'Usually, loops can be left at some nodes, the <em>loop exits</em>. Therefore, loop exits are ' +
            '<em>gateways</em>. If a loop has <em>no loop exit</em>, it cannot be left. For this reason, such a loop ' +
            'is called a <em>live lock</em> as the execution is trapped within the loop and the process model can never ' +
            'terminate.</p>');

        panel.append('<h2>Flaw in your process model</h2>');

        let entryType = entryProcessElement.type.substring(5);
        let entryLink = '<a data-element-link=\'' + JSON.stringify(asList(entry.elementIds)) + '\'>' + entryType  + '</a>';
        let entryImplicitExplicit = entryType.includes('Gateway') ? '' : 'implicit';

        let kind = (entry.getKind === GatewayType.AND ? 'parallel' : (entry.getKind === GatewayType.XOR ? 'exclusive' : 'inclusive'));

        panel.append('<p>The loop in your process model is highlighted and has the ' + entryImplicitExplicit + ' ' +
            kind + ' gateway (' + entryLink + ' in your model) as loop entry. However, no gateway or task in the loop ' +
            'has a sequence flow out of the loop. For this reason, once the execution is within this loop, it is ' +
            'trapped.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>Please consider to add an exclusive gateway as an explicit loop exit in your model as well as a ' +
            'sequence flow starting in this gateway and go out of the loop (at least to an end event).</p>');


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
            'Marlon Dumas, Marcello La Rosa, Jan Mendling, Hajo A. Reijers<br>' +
            '<a href="https://doi.org/10.1007/978-3-662-56509-4" target="_blank">Fundamentals of Business Process Management.</a><br>' +
            'Second Edition. Springer 2018, ISBN 978-3-662-56508-7, pp. 181-187.' +
            '</blockquote>');

        // Token simulation
        let simInformation = information.simulation;

        let simHandler = TokenSimulationHandling(modeler);
        simHandler.start();

        // Force to get to the entry
        let pathToEntry = simInformation.pathToEntry;
        simHandler.setDecisions(pathToEntry);

        simHandler.pauseIfExited(simInformation.entry, (node) => {
            message.append('<p>From this moment, the loop cannot be left and the execution is trapped in the loop.</p>');
        });

        simButton.on('click', function () {
            simHandler.controlElement(pathToEntry[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };
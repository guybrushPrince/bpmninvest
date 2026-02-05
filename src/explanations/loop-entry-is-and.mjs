import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import $ from 'jquery';
import { asList, asObject, union } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import {explanation as implicitStartExplanation} from "./implicit-start.mjs";
import {FaultKind} from "../modules/faultkind.mjs";

const LOOP_ENTRY_IS_AND = 'Wrong loop entry';

let visualizerModule = new VisualizerModule(
    FaultType.LOOP_ENTRY_IS_AND,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let loopEntry = elements.entry;
        let loop = elements.loop;
        let into = union(elements.into, {});
        into[loopEntry.getId] = loopEntry;
        loop.getEdges;
        visualizer.addErrorLine(loopEntry.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(loopEntry.getUI$, type, LOOP_ENTRY_IS_AND, (panel) => {
            loopEntry = asObject([ loopEntry ]);
            visualizer.setFocus(
                visualizer.mapModelToBPMNUI(into),
                visualizer.mapToUI(union(loopEntry, union(loop.getNodes, loop.getEdges)))
            );

            closerAction = this.getExplanation(panel, type, elements, visualizer, modeler);
        }, () => { closerAction(); });
    },
    function (panel, fType, information, visualizer, modeler) {
        let entry = information.entry;
        let pathFinder = PathFinderFactory(modeler);

        panel.append('<h1>Loop has a Loop Entry that is a Parallel Gateway</h1>');
        visualizer.appendFaultKind(panel, [
            { type: fType, kind: FaultKind.IMPROPER_LOOP },
            { type: fType, kind: FaultKind.SEMANTIC_FAULT },
            { type: FaultLevel.INFO, kind: FaultKind.NO_BEST_PRACTICE }
        ]);

        panel.append('<h2>Explanation</h2>');
        panel.append('<p><em>Loops</em> are cyclic structures in a process model, in which each node has a path to each ' +
            'other node of the loop (called <em>strongly connected component</em>, SCC). ' +
            'Usually, loops can be entered at some nodes, the <em>loop entries</em>, and can be left at some nodes, ' +
            'the <em>loop exits</em>. Therefore, loop entries and exits are <em>gateways</em>.</p>');
        panel.append('<p>Research and best practice has shown that loop entries that are ' +
            'converging <em>parallel</em> gateways lead to unexpected behavior in process models: ' +
            'either the gateway blocks locally when entering the loop (as no control flow can get to the incoming flow ' +
            'within the loop) or after the first iteration (as no control flow can get to the incoming flow outside of ' +
            'the loop). In both cases, there is <em>deadlock</em>, which hinders a proper option to complete and may ' +
            'lead to dead activies.</p>');

        let entryLink = visualizer.getElementLink(entry);
        let implicitExplicit = !entry.isImplicit ? '' : 'n implicit';

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>The loop being visualized by strong lined elements in the editor has a <em>loop entry</em> as ' +
            entryLink + ' being a' + implicitExplicit + ' <em>diverging parallel gateway</em>.</p>');
        panel.append('<p>The pulsating lines illustrate the flows that are going into the loop entry from outside the ' +
            'loop. ' +
            'Since the loop entry is a parallel gateway, it expects control flows on all its incoming flows in ' +
            'each iteration of the loop. Without another flaw in your process model, there is at least one instance ' +
            'of your process model, in which it blocks locally at this entry.' + '</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>If possible, replace the loop entry with a parallel or inclusive gateway and check subsequently ' +
            'if your process model still has the desired behavior.</p>');

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
        let pathToExit = simInformation.pathToExit;//(process).concat([]);
        let pathToEntry = simInformation.pathToEntry;//(process);

        let exitProcessElement = pathFinder.mapNodeSetToBPMN(asObject([ exit ])).concat([]);
        exitProcessElement = exitProcessElement.shift();

        for (let i = 0; i < pathToEntry.length; i++) {
            let el = pathToEntry[i];
            if (el === exitProcessElement.id) {
                if (pathToEntry.length > i + 1) pathToExit.push(pathToEntry[i + 1]);
                break;
            }
        }

        let simHandler = TokenSimulationHandling(modeler);
        simHandler.start();

        simHandler.setDecisions(pathToExit);

        simHandler.pauseIfEntered(exit, (node) => {
            simHandler.setDecisions(pathToEntry);

            simHandler.pauseIfEntered(entry, (node) => {
                message.append('<p>From this moment, the execution is locally blocked in the loop entry gateway ' +
                    entryLink + '.</p>');
            });
        }, false);

        simButton.on('click', function () {
            simHandler.controlElement(pathToExit[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };
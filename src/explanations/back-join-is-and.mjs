import { VisualizerModule } from "../modules/vismodule.mjs";
import { StandardFaultType as FaultType } from "../modules/stfaulttypes.mjs";
import { FaultLevel } from "../modules/faultbus.mjs";
import $ from 'jquery';
import { asList, asObject } from "../modules/settools.mjs";
import { TokenSimulationHandling } from "../modules/simsupport.mjs";
import { PathFinderFactory } from "../modules/pathfinder.mjs";
import {FaultKind} from "../modules/faultkind.mjs";

const LOOP_BACK_JOIN_IS_AND = 'Possible deadlock';

let visualizerModule = new VisualizerModule(
    FaultType.LOOP_BACK_JOIN_IS_AND,
    FaultLevel.ERROR,
    function (type, process, elements, visualizer, modeler) {
        let backJoin = elements.backJoin;
        visualizer.addErrorLine(backJoin.getUI$);
        let closerAction = () => {};
        visualizer.addOverlay(backJoin.getUI$, type, LOOP_BACK_JOIN_IS_AND, (panel) => {
            visualizer.setFocus(
                visualizer.mapModelToBPMNUI(elements.flaws),
                visualizer.mapModelToBPMNUI(elements.doBody)
            );

            closerAction = this.getExplanation(panel, type, elements, visualizer, modeler);
        }, () => { closerAction(); });
    },
    function (panel, fType, information, visualizer, modeler) {
        let backJoin = information.backJoin;

        panel.append('<h1>Inner Loop Node blocks Initially</h1>');
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
        panel.append('<p>The area between the loop entries and the first reachable loop exits is called the ' +
            '<em>do body</em> of the loop. Research has shown that it is not possible that any control flow receives from ' +
            'the flows being in the loop but <strong>not</strong> in the <em>do body</em>. For this reason, all elements ' +
            'within the <em>do body</em> having an incoming sequence flow from outside the <em>do body</em> (called a ' +
            '<em>back joins</em>) are gateways ' +
            'and shall not be parallel gateways as they have the potential for a <em>deadlock</em>. This hinders the ' +
            'proper option to complete and may lead to dead activities.</p>');

        let backJoinLink = visualizer.getElementLink(backJoin);
        let implicitExplicit = !backJoin.isImplicit ? '' : 'n implicit';

        panel.append('<h2>Flaw in your process model</h2>');
        panel.append('<p>The <em>do body</em> being visualized by strong lined elements in the editor has a back join as ' +
            backJoinLink + ' being a' + implicitExplicit + ' <em>diverging parallel gateway</em>.</p>');
        panel.append('<p>The pulsating lines illustrate the flows that are going into the back join from outside the ' +
            '<em>do body</em>. ' +
            'Since the back join is a parallel gateway, it expects control flows on all its incoming flows also in ' +
            'the initialation phasis of the loop. Without another flaw in your process model, there is at least one ' +
            'instance of your process model, in which it blocks locally at this ' + backJoinLink + '.</p>');

        panel.append('<h2>Repair suggestions</h2>');
        panel.append('<p>The main question you should ask yourself is: Is it necessary at all to converge the flows ' +
            'before a loop entry? If it is unnecessary, try to avoid such a convergence within a loop as it complicates ' +
            'the understanding of your process model. If it is necessary, then there are three main proposals to repair ' +
            'the flaw:</p>')
        panel.append('<ol>' +
            '<li>Are there concurrent control flows at all that have to be converged? If not, replace ' +
            backJoinLink + ' with an exclusive gateway.</li>' +
            '<li>Ensure that on all paths from outside the loop to the back join as well as within the loop, there are ' +
            'always "enough" concurrent control flows reaching the gateway. In such a case, ' + backJoinLink + ' will not ' +
            'be a back join anymore.</li>' +
            '<li>Although inclusive gateways should be avoided as they complicate the understanding of your process ' +
            'model, it could be a solution to replace the ' + backJoinLink + ' with an inclusive gateway.</li>' +
            '</ol>')


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
        let pathToNotIn = simInformation.pathToNotIn;

        let simHandler = TokenSimulationHandling(modeler);
        simHandler.start();

        simHandler.setDecisions(pathToNotIn);

        simHandler.pauseIfEntered(backJoin, (node) => {
            message.append('<p>From this moment, the execution is locally blocked in this ' + backJoinLink + '.</p>');
            visualizer.addElementLinkFunctions(message);
        }, false);

        simButton.on('click', function () {
            simHandler.controlElement(pathToNotIn[0]);
            $('.simulation-hint').empty();
        });

        return () => { simHandler.stop(); };
    }
);

export { visualizerModule };
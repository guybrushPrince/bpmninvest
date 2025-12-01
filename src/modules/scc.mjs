"use strict";
import { asList, union, diff, intersect } from "./settools.mjs";
import { BPMNModel, Loop, Gateway, GatewayType } from "./model.mjs";
import { FaultType, faultBus } from "./faultbus.mjs";
import {PathFinderFactory} from "./pathfinder.mjs";

/**
 * <p>Finds strongly connected components (aka loops) in a given model.
 * As methodology, the algorithm of Tarjan is used:</p>
 *
 * <cite>R. E. Tarjan, Depth-first search and linear graph algorithms, SIAM J. Comput. 1 (2) (1972) 146–160.
 * doi:10.1137/0201010.</cite>
 */
let SCC = function () {

    /**
     * A simple counter to assign a loop id to detected loops.
     * @type {number}
     */
    let loopId = 0;

    /**
     * The constructor of the SCC algorithm.
     * It initializes the necessary fields for SCC detection. For more details about the algorithm, we refer to the
     * paper above.
     * @constructor
     */
    function SCCFactory() {
        let glIndex = 0;
        let stack = [];
        let index = {};
        let lowlink = {};
        let successors = {};
        let components = [];

        /**
         * Finds the SCCs in a BPMN model and each included process model.
         * @param bpmn The BPMN model.
         * @returns {*[]}
         */
        this.findSCCs = function (bpmn) {
            if (!Array.isArray(bpmn)) bpmn = [bpmn];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    bpmn.getProcesses.forEach((p) => {
                        p.setLoops(this.analyze(p));
                    });
                }
            });
            return bpmn;
        };

        /**
         * FInds the SCC in a single process model.
         * @param process The process model as instance of Process.
         * @returns {*[]}
         */
        this.analyze = function (process) {
            components = [];
            // Initialize
            asList(process.getNodes).forEach((n) => {
                index[n.getId] = -1;
                lowlink[n.getId] = -1;
                successors[n.getId] = [];
            });

            // Determine the direct successors of each node
            asList(process.getEdges).forEach((e) => {
                successors[e.getSource.getId].push(e.getTarget);
            });
            // Analyze
            asList(process.getNodes).forEach((n) => {
                if (index[n.getId] === -1) strongConnected(n, process);
            });

            return components;
        }

        /**
         * Detects a SCC by traversing the process model and assigning index and lowlink values to the visited nodes.
         * If a node is visited twice, an SCC is detected with its nodes being on the stack.
         * @param node The current node at the traversal.
         * @param process The current process model.
         */
        let strongConnected = function (node, process) {
            index[node.getId] = glIndex;
            lowlink[node.getId] = glIndex++;

            stack.push(node);

            successors[node.getId].forEach((s) => {
                if (index[s.getId] === -1) {
                    strongConnected(s, process);
                    lowlink[node.getId] = Math.min(lowlink[node.getId], lowlink[s.getId]);
                } else if (stack.includes(s)) {
                    lowlink[node.getId] = Math.min(lowlink[node.getId], index[s.getId]);
                }
            });

            if (index[node.getId] === lowlink[node.getId]) {
                let component = new Loop('l' + loopId++, process);
                let preset = {};
                let postset = {};
                let current = null;
                do {
                    current = stack.pop();
                    component.addNode(current);
                    component.getUI.push(current.getUI);
                    component.addElementId(current.elementIds);
                    preset = union(preset, current.getPreset);
                    postset = union(postset, current.getPostset);
                } while (current.getId !== node.getId);

                // The SCC is only of interest if it contains at least 2 nodes (i.e., it is non-trivial).
                if (asList(component.getNodes).length > 1) {
                    // Determine entries and exits of the loop.
                    // This is efficiently done by set operations:
                    // preset contains all preset nodes of all nodes in the loop. Thus, this set without the nodes
                    // in the loop contains all nodes *outside* the loop but with a connection to a loop entry.
                    // The same is valid for postset.
                    preset = diff(preset, component.getNodes);
                    postset = diff(postset, component.getNodes);
                    // For all those detected nodes, all nodes in their postset being in the loop must be a loop entry.
                    // The same is valid for postset.
                    asList(preset).forEach(i => component.addEntries(intersect(i.getPostset, component.getNodes)));
                    asList(postset).forEach(o => component.addExits(intersect(o.getPreset, component.getNodes)));
                    // Determine the do-body and the edges of the loop.
                    component.getDoBody;
                    component.getEdges;

                    // Some fault detection regarding loop exits being no XOR, entries being ANDs, and dead loops
                    // (without an entry) as well as livelocks (without an exit).

                    // By
                    //
                    // Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
                    // Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
                    // DOI: https://doi.org/10.1016/j.is.2024.102476
                    //
                    // loop entries must be "XOR" (or "OR") and loop exits must be "XOR"
                    let exits = asList(component.getExits);
                    let entries = asList(component.getEntries);
                    exits.forEach(exit => {
                        if (exit instanceof Gateway && exit.getKind !== GatewayType.XOR) {
                            // This violates rule 2 in the above paper that each loop exit must be an XOR in
                            // sound process models.
                            // Find a path from a start to this loop exit in the model.
                            let pathFinder = PathFinderFactory();
                            let pathToExit = pathFinder.findPathFromStartToTarget(exit, process);
                            // Represent it as a path of BPMN elements being actual in the model.
                            if (pathToExit !== null) pathToExit = pathFinder.modelPathToBPMNPath(pathToExit);
                            else pathToExit = [];
                            // Inform the fault bus regarding the identified fault.
                            faultBus.addError(
                                process,
                                { // These are fault-specific information for visualization ...
                                    exit: exit,
                                    loop: component.copy(),
                                    out: intersect(exit.getPostset, postset),
                                    simulation: { // ... and simulation.
                                        pathToExit: pathToExit,
                                        exit: exit
                                    }
                                },
                                FaultType.LOOP_EXIT_NOT_XOR
                            );
                        }
                    });
                    entries.forEach(entry => {
                        if (entry instanceof Gateway && entry.getKind === GatewayType.AND) {
                            // This violates rule 1 in the above-mentioned paper: No loop entry can be an AND in
                            // a sound process model.
                            // We take any exit in the do-body that we force to execute.
                            let exit = asList(intersect(component.getExits, component.getDoBody)).shift();
                            // We select at least one incoming edge of the entry being in the loop.
                            let inLoop = intersect(component.getEdges, entry.getIncoming);
                            let inLoopSel = asList(inLoop)[0];
                            // Now we want to execute the loop until the exit, thus, we detect a path to the exit.
                            let pathFinder = PathFinderFactory();
                            let pathToExit = pathFinder.findPathFromStartToTarget(exit, process);
                            if (pathToExit !== null) pathToExit = pathFinder.modelPathToBPMNPath(pathToExit);
                            else pathToExit = [];
                            // Subsequently, the loop is iterated with a path from this exit back (in the loop) to
                            // the above-selected incoming edge of the entry.
                            let pathToEntry = pathFinder.findPathFromStartToTarget(inLoopSel.getSource, process);
                            if (pathToEntry !== null) pathToEntry = pathFinder.modelPathToBPMNPath(pathToEntry);
                            else pathToEntry = [];
                            // Inform the fault bus regarding the identified fault.
                            faultBus.addError(
                                process,
                                { // These are fault-specific information for visualization ...
                                    entry: entry,
                                    loop: component.copy(),
                                    into: intersect(entry.getPreset, preset),
                                    simulation: { // ... and simulation.
                                        pathToExit: pathToExit,
                                        pathToEntry: pathToEntry,
                                        exit: exit,
                                        entry: entry
                                    }
                                },
                                FaultType.LOOP_ENTRY_IS_AND
                            );
                        }
                    });
                    // By
                    //
                    // Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
                    // Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
                    // DOI: https://doi.org/10.1016/j.is.2024.102476
                    //
                    // loops are bad structured if they do not have an entry (dead loop) or exit (live lock)
                    if (entries.length === 0) {
                        // The loop is dead as it cannot be entered.
                        component.setDead(true);
                        let refExit = (exits.length >= 1) ? exits[0] : null;
                        // Inform the fault bus regarding the identified fault.
                        faultBus.addError(
                            process,
                            { // These are fault-specific information for visualization.
                                loop: component.copy(),
                                refExit: refExit // Nothing to simulate as it is dead.
                            },
                            FaultType.DEAD_LOOP
                        );
                    }
                    if (exits.length === 0 && entries.length >= 1) {
                        // The loop can be entered but not be left, a livelock.
                        // Just find a path from a start to an entry for simulation.
                        let refEntry = entries[0];
                        let pathToEntry = null;
                        let pathFinder = PathFinderFactory();
                        pathToEntry = pathFinder.findPathFromStartToTarget(refEntry, process);
                        if (pathToEntry !== null) pathToEntry = pathFinder.modelPathToBPMNPath(pathToEntry);
                        // Inform the fault bus regarding the identified livelock.
                        faultBus.addError(
                            process,
                            { // These are fault-specific information for visualization ...
                                loop: component.copy(),
                                refEntry: refEntry,
                                simulation: { // ... and simulation.
                                    pathToEntry: pathToEntry,
                                    entry: refEntry
                                }
                            },
                            FaultType.LIVE_LOCK
                        );
                    }

                    // Store the loop / component.
                    components.push(component);
                }
            }
        }
    }

    return new SCCFactory();
};

export { SCC };
"use strict";
/**
 * Finds strongly connected components (aka loops) in a given model.
 * As methodology, the algorithm of Tarjan is used:
 *
 * R. E. Tarjan, Depth-first search and linear graph algorithms, SIAM J. Comput. 1 (2) (1972) 146–160.
 * doi:10.1137/0201010.
 */
import { asList, union, diff, intersect } from "./settools.mjs";
import { BPMNModel, Loop, Gateway, GatewayType } from "./model.mjs";
import { FaultType, faultBus } from "./faultbus.mjs";
import {PathFinderFactory} from "./pathfinder.mjs";

let SCC = function () {

    let loopId = 0;

    function SCCFactory() {
        let glIndex = 0;
        let stack = [];
        let index = {};
        let lowlink = {};
        let successors = {};
        let components = [];

        /**
         * Finds the SCCs in a BPMN model.
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

                // The SCC is only of interest if it contains at least 2 nodes.
                if (asList(component.getNodes).length > 1) {
                    // Determine entries and exits of the loop.
                    preset = diff(preset, component.getNodes);
                    postset = diff(postset, component.getNodes);
                    asList(preset).forEach(i => component.addEntries(intersect(i.getPostset, component.getNodes)));
                    asList(postset).forEach(o => component.addExits(intersect(o.getPreset, component.getNodes)));
                    component.getDoBody;
                    component.getEdges;
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
                            let pathFinder = PathFinderFactory();
                            let pathToExit = pathFinder.findPathFromStartToTarget(exit, process);
                            if (pathToExit !== null) pathToExit = pathFinder.modelPathToBPMNPath(pathToExit);
                            else pathToExit = [];
                            faultBus.addError(
                                process,
                                {
                                    exit: exit,
                                    loop: component.copy(),
                                    out: intersect(exit.getPostset, postset),
                                    simulation: {
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
                            // We find a path to any exit that we force to execute.
                            let exit = asList(intersect(component.getExits, component.getDoBody)).shift();
                            let inLoop = intersect(component.getEdges, entry.getIncoming);
                            let inLoopSel = asList(inLoop)[0];
                            let pathFinder = PathFinderFactory();
                            let pathToExit = pathFinder.findPathFromStartToTarget(exit, process);
                            if (pathToExit !== null) pathToExit = pathFinder.modelPathToBPMNPath(pathToExit);
                            else pathToExit = [];
                            let pathToEntry = pathFinder.findPathFromStartToTarget(inLoopSel.getSource, process);
                            if (pathToEntry !== null) pathToEntry = pathFinder.modelPathToBPMNPath(pathToEntry);
                            else pathToEntry = [];
                            faultBus.addError(
                                process,
                                {
                                    entry: entry,
                                    loop: component.copy(),
                                    into: intersect(entry.getPreset, preset),
                                    simulation: {
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
                    // Loops are bad structured if they do not have an entry (dead loop) or exit (live lock)
                    if (entries.length === 0) {
                        component.setDead(true);
                        let refExit = (exits.length >= 1) ? exits[0] : null;
                        faultBus.addError(
                            process,
                            {
                                loop: component.copy(),
                                refExit: refExit // Nothing to simulate
                            },
                            FaultType.DEAD_LOOP
                        );
                    }
                    if (exits.length === 0 && entries.length >= 1) {
                        let refEntry = entries[0];
                        let pathToEntry = null;
                        let pathFinder = PathFinderFactory();
                        pathToEntry = pathFinder.findPathFromStartToTarget(refEntry, process);
                        if (pathToEntry !== null) pathToEntry = pathFinder.modelPathToBPMNPath(pathToEntry);
                        faultBus.addError(
                            process,
                            {
                                loop: component.copy(),
                                refEntry: refEntry,
                                simulation: {
                                    pathToEntry: pathToEntry,
                                    entry: refEntry
                                }
                            },
                            FaultType.LIVE_LOCK
                        );
                    }

                    components.push(component);
                }
            }
        }
    }

    return new SCCFactory();
};

export { SCC };
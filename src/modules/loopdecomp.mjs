import {asList, union, intersect, diff, asObject} from "./settools.mjs";
import {
    BPMNModel,
    Start,
    End,
    Gateway,
    GatewayType,
    LoopProcess,
    LoopTask,
    Edge,
    VirtualTask,
    LoopEntryGateway, LoopExitGateway
} from "./model.mjs";
import { Normalizer } from "./normalize.mjs";
import {flatten} from "array-flatten";

/**
 * Performs a loop decomposition of given process models and returns a set of acyclic process models where
 * acyclic process models resulting of loops are of type LoopProcess.
 *
 * The algorithms are based on:
 * Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
 * Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
 * DOI: https://doi.org/10.1016/j.is.2024.102476
 *
 * where the basic approach is described here:
 *
 * Thomas M. Prinz, Yongsun Choi, N. Long Ha (2024):
 * Understanding and Decomposing Control-Flow Loops in Business Process Models. BPM 2022: 307-323
 * DOI: https://doi.org/10.1007/978-3-031-16103-2_21
 */
const LoopDecomposition = (function () {

    let elementId = 0;

    function LoopDecompositionFactory() {

        let uniqueLoops = {};
        let acyclicProcesses = {};

        /**
         * Decompose a (set of) BPMN model(s).
         * @param bpmn
         * @returns {{}}
         */
        this.decompose = function (bpmn) {
            if (!Array.isArray(bpmn)) bpmn = [ bpmn ];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    acyclicProcesses = union(acyclicProcesses, bpmn.getProcesses.reduce((a, p) => {
                        a = union(a, decomposeProcess(p));
                        return a;
                    }, {}));
                }
            });
            return acyclicProcesses;
        };

        /**
         * Decompose (sometimes recursively) a process model.
         * @param process The process model.
         * @returns {{}}
         */
        let decomposeProcess = function (process) {
            let loops = process.getLoops;
            if (loops.length === 0) {
                // The process model is already acyclic and needs no decomposition.
                let self = {};
                self[process.getId] = process;
                return self;
            }

            // Else ...
            removeDeadLoops(process);
            let fragments = decomposeLoops(process);
            let allFragments = {};
            for (let fragment of asList(fragments)) {
                allFragments = union(allFragments, decomposeProcess(fragment));
            }

            return allFragments;
        };

        /**
         * Decompose the loops of the process model.
         * @param process The process model.
         * @returns {{}}
         */
        let decomposeLoops = function (process) {
            // Create a copy of the main process model.
            let mainProcess = copyMainProcess(process);
            let processes = { };
            processes[mainProcess.getId] = mainProcess;

            // Create a dictionary of the original nodes.
            let orgNodes = union(process.getNodes, {});
            // Get the nodes of the copy.
            let mainNodes = mainProcess.getNodes;

            process.getLoops.forEach(function (loop) {
                if (asList(loop.getExits).length === 0) {
                    // If the loop does not have an exit (a livelock), just remove it from the process model.
                    for (let node of asList(loop.getNodes)) {
                        if (!(node.getId in loop.getEntries)) {
                            // Delete the loop's nodes.
                            delete mainNodes[node.getId];
                            delete mainProcess.getNodes[node.getId];
                        }
                    }
                    for (let edge of asList(mainProcess.getEdges)) {
                        if (edge.getSource.getId in loop.getNodes) {
                            // Delete the loop's edges.
                            delete mainProcess.getEdges[edge.getId];
                        }
                    }
                } else {
                    // Each loop is identified uniquely by (one of) its loop exits (see the above-mentioned paper).
                    let identifierExit = asList(loop.getExits).map((e) => e.getId).join('-');
                    // Create a new process for the loop if it is not already there.
                    let loopProcess = null;
                    let newProcess = false;
                    if (!(identifierExit in uniqueLoops)) {
                        // The loop is new (was not detected in the copied do-body for example.
                        // Create a new process model for.
                        loopProcess = new LoopProcess(identifierExit);
                        loopProcess.setSuper(mainProcess);
                        processes[loopProcess.getId] = loopProcess;
                        uniqueLoops[identifierExit] = loopProcess;

                        // Copy all nodes of the loop to the new loop process model.
                        for (let node of asList(loop.getNodes)) {
                            let copy = node.copy;
                            loop.getNodes[node.getId] = copy;
                            if (node.getId in loop.getEntries) loop.getEntries[node.getId] = copy;
                            if (node.getId in loop.getExits) loop.getExits[node.getId] = copy;
                            loopProcess.addNode(copy);
                        }
                        newProcess = true;
                    } else loopProcess = uniqueLoops[identifierExit];

                    // The later entries to the loop (after conversion) are those exits being
                    // in the do-body.
                    let realEntries = {};
                    if (loop.getDoBody !== null) {
                        realEntries = intersect(loop.getExits, loop.getDoBody);
                    } else realEntries = loop.getEntries;
                    // Since we already have replaced the nodes in the loop with copies,
                    // we require those entries in the process model.
                    let processRealEntries = intersect(mainNodes, realEntries);
                    // The same holds true for loop exits.
                    let processExits = intersect(mainNodes, loop.getExits);

                    // Repair all exits and entries
                    asList(loop.getExits).forEach(el => {
                        if (el.getKind !== GatewayType.XOR) {
                            el.setKind(GatewayType.XOR);
                            el.setRepaired(true);
                        }
                    });
                    asList(loop.getEntries).forEach(el => {
                        if (el.getKind === GatewayType.AND) {
                            el.setKind(GatewayType.OR);
                            el.setRepaired(true);
                        }
                    });

                    // Remove all nodes of the loop being not in its do-body (except the exits).
                    let nonDoBody = diff(loop.getNodes, loop.getDoBody);
                    nonDoBody = union(nonDoBody, processExits);
                    mainNodes = diff(mainNodes, nonDoBody);

                    // Get the loop incoming edges
                    let loopIncoming = asList(mainProcess.getEdges).filter((f) => {
                        return f.getTarget.getId in processRealEntries;
                    });
                    let sendToLoop = asObject(loopIncoming.map((incoming) => {
                        let tgt = incoming.getTarget;
                        let intermediate = new VirtualTask('ln' + elementId++ + '-' + tgt.getId);
                        intermediate.addElementId(tgt.elementIds);
                        intermediate.setUI(tgt.getUI);
                        delete mainNodes[tgt.getId];
                        incoming.setTarget(intermediate);
                        mainNodes[intermediate.getId] = intermediate;
                        return intermediate;
                    }));
                    let xorCon = asList(sendToLoop)[0];
                    if (asList(sendToLoop).length >= 2) {
                        xorCon = new LoopEntryGateway('ln' + elementId++, processRealEntries);
                        xorCon.setUI(asList(processRealEntries).map(p => p.getUI));
                        xorCon.addElementId(flatten(asList(processRealEntries).map(p => p.elementIds)));
                        mainNodes[xorCon.getId] = xorCon;
                        asList(sendToLoop).forEach((intermediate) => {
                            let f = new Edge(intermediate.getId + '-' + xorCon.getId, intermediate, xorCon);
                            f.addElementId(intermediate.elementIds);
                            f.setUI(intermediate.getUI);
                            mainProcess.addEdge(f);
                        });
                    }

                    // Get the loop outgoing edges
                    let loopOutgoing = asList(mainProcess.getEdges).filter((f) => {
                        return !(f.getTarget.getId in loop.getNodes) && f.getSource.getId in processExits;
                    });
                    let catchFromLoop = asObject(loopOutgoing.map((outgoing) => {
                        let src = outgoing.getSource;
                        let intermediate = new VirtualTask('ln' + elementId++ + '-' + src.getId);
                        intermediate.addElementId(src.elementIds);
                        intermediate.setUI(src.getUI);
                        delete mainNodes[src.getId];
                        outgoing.setSource(intermediate);
                        mainNodes[intermediate.getId] = intermediate;
                        return intermediate;
                    }));
                    let xorDiv = asList(catchFromLoop)[0];
                    if (asList(catchFromLoop).length >= 2) {
                        xorDiv = new LoopExitGateway('ln' + elementId++, processExits);
                        xorDiv.setUI(asList(processExits).map(p => p.getUI));
                        xorDiv.addElementId(flatten(asList(processExits).map(p => p.elementIds)));
                        mainNodes[xorDiv.getId] = xorDiv;
                        asList(catchFromLoop).forEach((intermediate) => {
                            let f = new Edge(xorDiv.getId + '-' + intermediate.getId, xorDiv, intermediate);
                            f.addElementId(intermediate.elementIds);
                            f.setUI(intermediate.getUI);
                            mainProcess.addEdge(f);
                        });
                    }

                    // Insert a loop node for the loop
                    let loopNode = new LoopTask('ln' + elementId++, loopProcess);
                    loopNode.setUI(loop.getUI);
                    loopNode.addElementId(loop.elementIds);
                    mainNodes[loopNode.getId] = loopNode;
                    // Add edges
                    let inL = new Edge('ln' + elementId++, xorCon, loopNode);
                    inL.setUI(loopNode.getUI);
                    inL.addElementId(loopNode.elementIds);
                    mainProcess.addEdge(inL);
                    let outL = new Edge('ln' + elementId++, loopNode, xorDiv);
                    outL.setUI(loopNode.getUI);
                    outL.addElementId(loopNode.elementIds);
                    mainProcess.addEdge(outL);

                    mainProcess.setNodes(mainNodes);

                    // There are too much flows in the process and not enough in the loop process
                    let processFlows = union(process.getEdges, {});
                    let mainProcessFlows = union(mainProcess.getEdges, {});

                    // Eliminate the flows in the non-do-body
                    asList(mainProcessFlows).forEach((flow) => {
                        if (flow.getSource.getId in nonDoBody || flow.getTarget.getId in nonDoBody) {
                            delete mainProcessFlows[flow.getId];
                        }
                    });

                    asList(processFlows).forEach((flow) => {
                        let source = flow.getSource, target = flow.getTarget;

                        // There are variants:
                        // 1. Parts of the edges are not in the process anymore: Remove them from the process.
                        let srcExists = (source.getId in orgNodes);
                        let tgtExists = (target.getId in orgNodes);
                        if (!srcExists || !tgtExists) {
                            delete mainProcessFlows[flow.getId];
                        }
                        // 2. The edge is connected to the loop
                        if (newProcess && ((source.getId in loop.getNodes) || (target.getId in loop.getNodes))) {
                            // a. The edge has a loop exit as target
                            if (target.getId in loop.getExits) {
                                // Insert a new start
                                let lTarget = loop.getNodes[target.getId];
                                let start = new Start('ln' + elementId++, 'Start');
                                start.setUI(source.getUI);
                                start.addElementId(source.elementIds);
                                loopProcess.addNode(start);

                                let startEdge = new Edge('ln' + elementId++, start, lTarget);
                                startEdge.setUI(start.getUI);
                                startEdge.addElementId(start.elementIds);
                                loopProcess.addEdge(startEdge);

                                // Insert a new end (the source must be in the loop)
                                let lSource = loop.getNodes[source.getId];

                                let end = new End('ln' + elementId++, 'End');
                                end.setUI(target.getUI);
                                end.addElementId(target.elementIds);
                                loopProcess.addNode(end);

                                let endEdge = new Edge('ln' + elementId++, lSource, end);
                                endEdge.setUI(end.getUI);
                                endEdge.addElementId(end.elementIds);
                                loopProcess.addEdge(endEdge);

                            } else if (source.getId in loop.getExits && !(target.getId in loop.getNodes)) {
                                // Insert a new end
                                let lSource = loop.getNodes[source.getId];
                                let end = new End('ln' + elementId++, 'End');
                                end.setUI(source.getUI);
                                end.addElementId(source.elementIds);
                                loopProcess.addNode(end);
                                let endEdge = new Edge('ln' + elementId++, lSource, end);
                                endEdge.setUI(end.getUI);
                                endEdge.addElementId(end.elementIds);
                                loopProcess.addEdge(endEdge);

                                // We do not need the flow in the loop net, so we do not add it.
                            } else {
                                // b. The flow is an inner flow, add it.
                                if ((source.getId in loop.getNodes) && (target.getId in loop.getNodes)) {
                                    let edge = new Edge(flow.getId, loopProcess.getNodes[source.getId], loopProcess.getNodes[target.getId]);
                                    edge.setUI(flow.getUI);
                                    edge.addElementId(flow.elementIds);
                                    loopProcess.addEdge(edge);
                                }
                            }
                        }
                    });
                    mainProcess.setEdges(mainProcessFlows);

                    // If a new process was created, normalize it.
                    if (newProcess) {
                        Normalizer.normalizeProcess(loopProcess, false);
                    }
                }

            });
            // Normalize the process model for the next round.
            Normalizer.normalizeProcess(mainProcess, false);

            return processes;
        };

        let removeDeadLoops = function (process) {
            let dead = {};
            let liveLoops = process.getLoops.filter(loop => {
                if (!loop.isDead && asList(loop.getExits).length >= 1) return true;

                asList(loop.getNodes).forEach(n => {
                    delete process.getNodes[n.getId];
                    asList(union(n.getIncoming, n.getOutgoing)).forEach(e => {
                        dead[e.getSource.getId] = e.getSource;
                        dead[e.getTarget.getId] = e.getTarget;
                        delete process.getEdges[e.getId];
                    });
                });

                return false;
            });
            process.setLoops(liveLoops);
            process.computeInOut();
            // Remove dead nodes and edges
            do {
                dead = intersect(dead, process.getNodes);
                if (asList(dead).length > 0) {
                    let deadNode = asList(dead).shift();
                    delete dead[deadNode.getId];
                    if (asList(deadNode.getIncoming).length === 0) {
                        // It is really dead.
                        delete process.getNodes[deadNode.getId];
                        asList(deadNode.getOutgoing).forEach(o => {
                            let t = o.getTarget;
                            delete t.getIncoming[o.getId];
                            delete process.getEdges[o.getId];
                            dead[t.getId] = t;
                        });
                    }
                }
            } while (asList(dead).length > 0);
            process.computeInOut();
        };

        let copyMainProcess = function (process) {
            return process.copy();
        };
    }

    return function() {
        return new LoopDecompositionFactory();
    }
})();

export { LoopDecomposition };
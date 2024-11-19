let LoopDecomposition = (function () {

    let elementId = 0;

    function LoopDecompositionFactory() {

        let uniqueLoops = {};
        let acyclicProcesses = {};

        this.decompose = function (bpmn) {
            if (!Array.isArray(bpmn)) bpmn = [ bpmn ];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    acyclicProcesses = union(acyclicProcesses, bpmn.getProcesses.reduce((a, p) => {
                        a = union(a, decomposeProcess(p));
                        return a;
                    }, {}));
                    //Object.values(acyclicProcesses).forEach(p => console.log(p.asDot()));
                }
            });
            return acyclicProcesses;
        };

        let decomposeProcess = function (process) {
            let loops = process.getLoops;
            if (loops.length === 0) {
                let self = {};
                self[process.getId] = process;
                return self;
            }

            // Else ...
            let fragments = decomposeLoops(process);
            let allFragments = {};
            for (let fragment of Object.values(fragments)) {
                allFragments = union(allFragments, decomposeProcess(fragment));
            }

            return allFragments;
        }

        let decomposeLoops = function (process) {
            let processes = { };
            processes[process.getId] = process;

            process.getLoops.forEach(function (loop) {
                let identifierExit = Object.values(loop.getExits)[0];
                // Create a new process for the loop if it is not already there.
                let loopProcess = null;
                let newProcess = false;
                if (!(identifierExit.getId in uniqueLoops)) {
                    loopProcess = new LoopProcess(identifierExit.getId);
                    processes[loopProcess.getId] = loopProcess;
                    uniqueLoops[identifierExit.getId] = loopProcess;

                    // Copy all nodes of the loop
                    for (let node of Object.values(loop.getNodes)) {
                        let copy = node.copy;
                        loop.getNodes[node.getId] = copy;
                        if (node.getId in loop.getEntries) loop.getEntries[node.getId] = copy;
                        if (node.getId in loop.getExits) loop.getExits[node.getId] = copy;
                        loopProcess.addNode(copy);
                    }
                    newProcess = true;
                } else loopProcess = uniqueLoops[identifierExit.getId];

                // Determine the entries and exits
                let realEntries = {};
                if (loop.getDoBody !== null) {
                    realEntries = intersect(loop.getExits, loop.getDoBody);
                } else realEntries = loop.getEntries;
                let processRealEntries = intersect(process.getNodes, realEntries);
                let processExits = intersect(process.getNodes, loop.getExits);

                // Remove all nodes of the loop being not in its do-body (except the exits).
                let nonDoBody = diff(loop.getNodes, loop.getDoBody);
                nonDoBody = union(nonDoBody, processExits);
                process.setNodes(diff(process.getNodes, nonDoBody));

                // Insert a loop node for the loop
                let loopNode = new LoopTask('ln' + elementId++, loopProcess);
                loopNode.setUI(loop.getUI);
                process.addNode(loopNode);
                // Insert the converging gateway
                let xorCon = new Gateway('ln' + elementId++, null, GatewayType.XOR);
                xorCon.setUI(Object.values(processRealEntries).map(p => p.getUI));
                process.addNode(xorCon);
                // Insert the diverging gateway
                let xorDiv = new Gateway('ln' + elementId++, null, GatewayType.XOR);
                xorDiv.setUI(Object.values(processExits).map(p => p.getUI));
                process.addNode(xorDiv);
                // Add edges
                let inL = new Edge('ln' + elementId++, xorCon, loopNode);
                inL.setUI(loopNode.getUI);
                process.addEdge(inL);
                let outL = new Edge('ln' + elementId++, loopNode, xorDiv);
                outL.setUI(loopNode.getUI);
                process.addEdge(outL);
                xorCon.addPostset(loopNode); loopNode.addPreset(xorCon);
                loopNode.addPostset(xorDiv); xorDiv.addPreset(loopNode);

                // Insert edges from the entries (exits being in the do-body) to the converging XOR.
                Object.values(processRealEntries).forEach(entry => {
                    xorCon.setPreset(union(xorCon.getPreset, intersect(entry.getPreset, loop.getDoBody)));
                })
                // Insert edges from the diverging XOR to all nodes outside the loop and in the postset of exits.
                Object.values(processExits).forEach(exit => {
                    xorDiv.setPostset(union(xorDiv.getPostset, diff(exit.getPostset, loop.getNodes)));
                });
                // We have to update the predecessors and successors, respectively, of the loop entries and exits.
                Object.values(xorCon.getPreset).forEach(pred => {
                    pred.setPostset(diff(pred.getPostset, realEntries));
                    pred.addPostset(xorCon);
                    let edge = new Edge('ln' + elementId++, pred, xorCon);
                    process.addEdge(edge);
                    Object.values(pred.getOutgoing).forEach(o => {
                        if (o.getTarget.getId in realEntries) {
                            edge.setUI(o.getUI);
                        }
                    });
                });

                Object.values(xorDiv.getPostset).forEach(succ => {
                    succ.setPreset(diff(succ.getPreset, loop.getExits));
                    succ.addPreset(xorDiv);
                    let edge = new Edge('ln' + elementId++, xorDiv, succ);
                    process.addEdge(edge);
                    Object.values(succ.getIncoming).forEach(i => {
                        if (i.getSource.getId in loop.getExits) {
                            edge.setUI(i.getUI);
                        }
                    });
                });
                if (Object.values(xorCon.getPreset).length === 1) {
                    let xorConT = new VirtualTask(xorCon.getId);
                    xorConT.setUI(xorCon.getUI);
                    process.replaceNode(xorCon, xorConT);
                    xorCon = xorConT;
                }
                if (Object.values(xorDiv.getPostset).length === 1) {
                    let xorDivT = new VirtualTask(xorDiv.getId);
                    xorDivT.setUI(xorDiv.getUI);
                    process.replaceNode(xorDiv, xorDivT);
                    xorDiv = xorDivT;
                }

                // There are too much flows in the process and not enough in the loop process
                Object.values(process.getEdges).forEach((flow) => {
                    let source = flow.getSource, target = flow.getTarget;

                    // There are variants:
                    // 1. Parts of the edges are not in the process anymore: Remove them from the process.
                    let srcExists = (source.getId in process.getNodes);
                    let tgtExists = (target.getId in process.getNodes);
                    if (!srcExists || !tgtExists) {
                        if (srcExists || tgtExists) {
                            if (tgtExists) delete target.getPreset[source.getId];
                            else delete source.getPostset[target.getId];
                        }
                        delete process.getEdges[flow.getId];
                    }
                    // 2. The edge is connected to the loop
                    if (newProcess && ((source.getId in loop.getNodes) || (target.getId in loop.getNodes))) {
                        // a. The edge has a loop exit as target
                        if (target.getId in loop.getExits) {
                            // Insert a new start
                            let lTarget = loop.getNodes[target.getId];
                            let start = new Start('ln' + elementId++, 'Start');
                            start.setUI(source.getUI);
                            loopProcess.addNode(start);
                            let startEdge = new Edge('ln' + elementId++, start, lTarget);
                            startEdge.setUI(start.getUI);
                            loopProcess.addEdge(startEdge);

                            // Insert a new end (the source must be in the loop)
                            let lSource = loop.getNodes[source.getId];
                            if (target.getId in realEntries) {
                                // Insert a new gateway, which represents the old exit
                                let g = new Gateway('ln' + elementId++, null, GatewayType.XOR);
                                g.setUI(target.getUI);
                                loopProcess.addNode(g);
                                let gEdge = new Edge('ln' + elementId++, lSource, g);
                                gEdge.setUI(g.getUI);
                                loopProcess.addEdge(gEdge);
                                // Insert a start node coming from outside the loop
                                let start2 = new Start('ln' + elementId++, 'Start');
                                start2.setUI(target.getUI);
                                loopProcess.addNode(start2);
                                let start2Edge = new Edge('ln' + elementId++, start2, g);
                                start2Edge.setUI(start2.getUI);
                                loopProcess.addEdge(start2Edge);

                                let end = new End('ln' + elementId++, 'End');
                                end.setUI(target.getUI);
                                loopProcess.addNode(end);
                                let endEdge = new Edge('ln' + elementId++, g, end);
                                endEdge.setUI(end.getUI);
                                loopProcess.addEdge(endEdge);
                            } else {
                                let end = new End('ln' + elementId++, 'End');
                                end.setUI(target.getUI);
                                loopProcess.addNode(end);
                                let endEdge = new Edge('ln' + elementId++, lSource, end);
                                endEdge.setUI(end.getUI);
                                loopProcess.addEdge(endEdge);
                            }

                            delete lTarget.getPreset[source.getId];
                            delete lSource.getPostset[target.getId];

                        } else if (source.getId in loop.getExits && !(target.getId in loop.getNodes)) {
                            // Insert a new end
                            let lSource = loop.getNodes[source.getId];
                            let end = new End('ln' + elementId++, 'End');
                            end.setUI(source.getUI);
                            loopProcess.addNode(end);
                            let endEdge = new Edge('ln' + elementId++, lSource, end);
                            endEdge.setUI(end.getUI);
                            loopProcess.addEdge(endEdge);

                            // We do not need the flow in the loop net, so we do not add it.
                        } else {
                            // b. The flow is an inner flow, add it.
                            if ((source.getId in loop.getNodes) && (target.getId in loop.getNodes)) {
                                let edge = new Edge(flow.getId, loopProcess.getNodes[source.getId], loopProcess.getNodes[target.getId]);
                                edge.setUI(flow.getUI);
                                loopProcess.addEdge(edge);
                            }
                        }
                    }
                });

                if (newProcess) {
                    Normalizer.normalizeProcess(loopProcess, false);
                }

            });
            process.setLoops(null);
            Normalizer.normalizeProcess(process, false);

            return processes;
        }
    }

    return function() {
        return new LoopDecompositionFactory();
    }
})();
let SCC = function () {

    let loopId = 0;

    function SCCFactory() {
        let glIndex = 0;
        let stack = [];
        let index = {};
        let lowlink = {};
        let successors = {};
        let components = [];

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
        this.analyze = function (process) {
            // Initialize
            Object.values(process.getNodes).forEach((n) => {
                index[n.getId] = -1;
                lowlink[n.getId] = -1;
                successors[n.getId] = [];
            });

            // Determine the direct successors of each node
            Object.values(process.getEdges).forEach((e) => {
                successors[e.getSource.getId].push(e.getTarget);
            });
            // Analyze
            Object.values(process.getNodes).forEach((n) => {
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
                    preset = union(preset, current.getPreset);
                    postset = union(postset, current.getPostset);
                } while (current.getId !== node.getId);

                if (Object.values(component.getNodes).length > 1) {
                    preset = diff(preset, component.getNodes);
                    postset = diff(postset, component.getNodes);
                    Object.values(preset).forEach(i => component.addEntries(intersect(i.getPostset, component.getNodes)));
                    Object.values(postset).forEach(o => component.addExits(intersect(o.getPreset, component.getNodes)));
                    component.getDoBody;
                    // By
                    //
                    // Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
                    // Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
                    // DOI: https://doi.org/10.1016/j.is.2024.102476
                    //
                    // loop entries must be "XOR" (or "OR") and loop exits must be "XOR"
                    Object.values(component.getExits).forEach(exit => {
                        if (exit instanceof Gateway && exit.getKind !== GatewayType.XOR) {
                            faultBus.addError(
                                process,
                                { exit: exit, loop: component},
                                FaultType.LOOP_EXIT_NOT_XOR
                            );
                        }
                    });
                    Object.values(component.getEntries).forEach(entry => {
                        if (entry instanceof Gateway && entry.getKind === GatewayType.AND) {
                            faultBus.addError(
                                process,
                                { entry: entry, loop: component},
                                FaultType.LOOP_ENTRY_IS_AND
                            );
                        }
                    });

                    components.push(component);
                }
            }
        }
    }

    return new SCCFactory();
};
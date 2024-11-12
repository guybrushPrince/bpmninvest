let SCC = function () {
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
                if (index[n.getId] === -1) strongConnected(n);
            });

            return components;
        }

        let strongConnected = function (node) {
            index[node.getId] = glIndex;
            lowlink[node.getId] = glIndex++;

            stack.push(node);

            successors[node.getId].forEach((s) => {
                if (index[s.getId] === -1) {
                    strongConnected(s);
                    lowlink[node.getId] = Math.min(lowlink[node.getId], lowlink[s.getId]);
                } else if (stack.includes(s)) {
                    lowlink[node.getId] = Math.min(lowlink[node.getId], index[s.getId]);
                }
            });

            if (index[node.getId] === lowlink[node.getId]) {
                let component = [];
                let current = null;
                do {
                    current = stack.pop();
                    component.push(current);
                } while (current.getId !== node.getId);

                if (component.length > 1) components.push(component);
            }
        }
    }

    return new SCCFactory();
};
// Mock functions copied from WorkspaceContext.jsx

function isGlossaryChanged(oldGlossary, newGlossary) {
  const oldKeys = Object.keys(oldGlossary || {}).sort();
  const newKeys = Object.keys(newGlossary || {}).sort();
  if (oldKeys.length !== newKeys.length) return true;
  for (let i = 0; i < oldKeys.length; i++) {
    if (oldKeys[i] !== newKeys[i]) return true;
    if (oldGlossary[oldKeys[i]] !== newGlossary[newKeys[i]]) return true;
  }
  return false;
}

function isGlobalConstraintsChanged(oldConstraints, newConstraints) {
  const oldSorted = [...(oldConstraints || [])].sort();
  const newSorted = [...(newConstraints || [])].sort();
  return JSON.stringify(oldSorted) !== JSON.stringify(newSorted);
}

function getAdjustedNodesWithTodoPropagation(oldNodes, newNodes) {
  const oldNodesMap = new Map((oldNodes || []).map(n => [n.id, n]));
  const directlyAffected = new Set();

  for (const node of newNodes) {
    const oldNode = oldNodesMap.get(node.id);
    if (!oldNode) {
      continue;
    }

    const oldDepsSorted = [...(oldNode.dependencies || [])].sort();
    const newDepsSorted = [...(node.dependencies || [])].sort();
    const depsChanged = JSON.stringify(oldDepsSorted) !== JSON.stringify(newDepsSorted);

    const oldConstraints = oldNode.synthesis?.extractedConstraints || [];
    const newConstraints = node.synthesis?.extractedConstraints || [];
    const constraintsChanged = oldConstraints.length !== newConstraints.length ||
      oldConstraints.some((c, idx) => c !== newConstraints[idx]);

    const specChanged =
      (node.name || '') !== (oldNode.name || '') ||
      (node.produce || '') !== (oldNode.produce || '') ||
      (node.vibeNotes || '') !== (oldNode.vibeNotes || '') ||
      (node.synthesis?.intentSignal || '') !== (oldNode.synthesis?.intentSignal || '') ||
      depsChanged ||
      constraintsChanged ||
      ((node.synthesis?.filePath || '') !== (oldNode.synthesis?.filePath || '') &&
       !(oldNode.synthesis?.status !== 'completed' && node.synthesis?.status === 'completed' && !oldNode.synthesis?.filePath));

    if (specChanged) {
      directlyAffected.add(node.id);
    }
  }

  if (directlyAffected.size === 0) {
    return newNodes;
  }

  const allAffected = new Set(directlyAffected);
  let addedNew = true;

  while (addedNew) {
    addedNew = false;
    for (const node of newNodes) {
      if (!allAffected.has(node.id)) {
        const hasAffectedDep = (node.dependencies || []).some(depId => allAffected.has(depId));
        if (hasAffectedDep) {
          allAffected.add(node.id);
          addedNew = true;
        }
      }
    }
  }

  return newNodes.map(node => {
    if (allAffected.has(node.id)) {
      if (node.synthesis?.status !== 'todo') {
        return {
          ...node,
          synthesis: {
            ...(node.synthesis || {}),
            status: 'todo'
          }
        };
      }
    }
    return node;
  });
}

// Test cases
const oldNodes = [
  {
    id: "node-a",
    name: "Node A",
    vibeNotes: "Original notes",
    dependencies: [],
    synthesis: { status: "completed", filePath: "src/A.js" }
  },
  {
    id: "node-b",
    name: "Node B",
    dependencies: ["node-a"],
    synthesis: { status: "completed", filePath: "src/B.js" }
  },
  {
    id: "node-c",
    name: "Node C",
    dependencies: ["node-b"],
    synthesis: { status: "completed", filePath: "src/C.js" }
  },
  {
    id: "node-d",
    name: "Node D",
    dependencies: [],
    synthesis: { status: "completed", filePath: "src/D.js" }
  }
];

console.log("=== Test Case 1: No change ===");
let newNodes = JSON.parse(JSON.stringify(oldNodes));
let result = getAdjustedNodesWithTodoPropagation(oldNodes, newNodes);
console.log("Are they same?", JSON.stringify(result) === JSON.stringify(oldNodes) ? "YES" : "NO");

console.log("\n=== Test Case 2: Modify vibeNotes of Node A ===");
newNodes = JSON.parse(JSON.stringify(oldNodes));
newNodes[0].vibeNotes = "Updated notes for A";
result = getAdjustedNodesWithTodoPropagation(oldNodes, newNodes);
console.log("Node A status:", result[0].synthesis.status); // should be todo
console.log("Node B status:", result[1].synthesis.status); // should be todo (depends on A)
console.log("Node C status:", result[2].synthesis.status); // should be todo (depends on B)
console.log("Node D status:", result[3].synthesis.status); // should be completed (independent)

console.log("\n=== Test Case 3: Dependency Change (B no longer depends on A, but depends on D) ===");
newNodes = JSON.parse(JSON.stringify(oldNodes));
newNodes[1].dependencies = ["node-d"];
result = getAdjustedNodesWithTodoPropagation(oldNodes, newNodes);
console.log("Node A status:", result[0].synthesis.status); // should be completed (no spec change)
console.log("Node B status:", result[1].synthesis.status); // should be todo (dependency list changed)
console.log("Node C status:", result[2].synthesis.status); // should be todo (depends on B)
console.log("Node D status:", result[3].synthesis.status); // should be completed

console.log("\n=== Test Case 4: FilePath transition from todo to completed for the first time ===");
const oldNodesTransition = [
  {
    id: "node-a",
    name: "Node A",
    dependencies: [],
    synthesis: { status: "todo", filePath: "" }
  },
  {
    id: "node-b",
    name: "Node B",
    dependencies: ["node-a"],
    synthesis: { status: "completed", filePath: "src/B.js" }
  }
];
const newNodesTransition = JSON.parse(JSON.stringify(oldNodesTransition));
newNodesTransition[0].synthesis.status = "completed";
newNodesTransition[0].synthesis.filePath = "src/A.js";
result = getAdjustedNodesWithTodoPropagation(oldNodesTransition, newNodesTransition);
console.log("Node A status:", result[0].synthesis.status); // should be completed
console.log("Node B status:", result[1].synthesis.status); // should be completed (not set to todo because it's a first time filePath implementation transition)

console.log("\n=== Test Case 5: FilePath update on already completed node ===");
newNodes = JSON.parse(JSON.stringify(oldNodes));
newNodes[0].synthesis.filePath = "src/newA.js";
result = getAdjustedNodesWithTodoPropagation(oldNodes, newNodes);
console.log("Node A status:", result[0].synthesis.status); // should be todo
console.log("Node B status:", result[1].synthesis.status); // should be todo (depends on A)
console.log("Node C status:", result[2].synthesis.status); // should be todo (depends on B)
console.log("Node D status:", result[3].synthesis.status); // should be completed

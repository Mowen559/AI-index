import { getLLMProvider } from "./src/lib/llm/provider";
import path from "path";

async function testUnderstandAnything() {
  console.log("Initializing LLM Provider...");
  const llm = getLLMProvider();
  
  const targetPath = path.resolve(__dirname, "src/lib/llm"); // Test on a small directory
  console.log(`Starting analysis on: ${targetPath}`);

  try {
    await llm.executeUnderstandAnything(targetPath, {
      onProgress: (msg) => console.log(msg)
    });
    console.log("Analysis completed successfully!");
  } catch (error) {
    console.error("Analysis failed:", error);
  }
}

testUnderstandAnything();

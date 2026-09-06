import { compileToEditableStatblock } from "./editableCompiler.js";
import { callOllamaStructured } from "./ollamaClient.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { analyzeStatblock } from "./pipeline.js";
import type { StructureModelCaller } from "./modelProvider.js";
import type { EditableStatblockDocument } from "./productModel.js";
import type { ParserMode } from "./parserRouting.js";

export type ParseForProductInput = {
  rawSource: string;
  model: string;
  language?: string;
  callModel?: StructureModelCaller;
  parserMode?: ParserMode;
};

/*
 * Product boundary. Application code should consume this function/result rather than
 * LosslessStatblockDocument, candidates, annotations or model diagnostics. Those remain
 * parser implementation details and may change independently of the product model.
 *
 * The product boundary accepts the selected model identifier plus an optional
 * StructureModelCaller. Provider/profile selection belongs to the application
 * configuration layer; parser internals remain hidden from product consumers.
 */
export async function parseForProduct(input: ParseForProductInput): Promise<EditableStatblockDocument> {
  const sourceMap = createLosslessSourceMap(input.rawSource);
  const analyzed = await analyzeStatblock({
    rawSource: input.rawSource,
    sourceMap,
    model: input.model,
    callModel: input.callModel ?? callOllamaStructured,
    parserMode: input.parserMode ?? "auto",
  });

  return compileToEditableStatblock(analyzed.document, {
    language: input.language,
    parserStructure: analyzed.parserRouting.selectedMode === "generic" ? "mixed" : analyzed.parserRouting.selectedMode,
  });
}

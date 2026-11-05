import { expect, test } from "bun:test";
import { requiresCrossChannelConfirmation } from "./album-destination";

test("a batch from multiple channels still requires confirmation for a destination in one source channel",()=>{
  expect(requiresCrossChannelConfirmation([1,2],1)).toBe(true);
  expect(requiresCrossChannelConfirmation([1,1],1)).toBe(false);
  expect(requiresCrossChannelConfirmation([null,1],1)).toBe(true);
  expect(requiresCrossChannelConfirmation([1],null)).toBe(true);
});

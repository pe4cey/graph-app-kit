import React from "react";
import TestRenderer from "react-test-renderer";
import { Render } from "./index";

it("loads Render (no output)", () => {
  const out = TestRenderer.create(<Render if={1 === 2}>Hello</Render>);
  expect(out.toJSON()).toEqual(null);
});
it("loads Render (with output)", () => {
  const out = TestRenderer.create(
    <Render if={true}>
      <span>Hello</span>
    </Render>
  );
  expect(out.toJSON()).toMatchSnapshot();
});

import { Box, Flex, Text } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useAppSelector } from 'app/store/storeHooks';
import {
  $isDrawing,
  $isMouseDown,
  $lastAddedPoint,
  $lastCursorPos,
  $lastMouseDownPos,
  $stageAttrs,
} from 'features/controlLayers/store/canvasV2Slice';
import { round } from 'lodash-es';
import { memo } from 'react';

export const HeadsUpDisplay = memo(() => {
  const stageAttrs = useStore($stageAttrs);
  const cursorPos = useStore($lastCursorPos);
  const isDrawing = useStore($isDrawing);
  const isMouseDown = useStore($isMouseDown);
  const lastMouseDownPos = useStore($lastMouseDownPos);
  const lastAddedPoint = useStore($lastAddedPoint);
  const bbox = useAppSelector((s) => s.canvasV2.bbox);
  const document = useAppSelector((s) => s.canvasV2.document);

  return (
    <Flex flexDir="column" bg="blackAlpha.400" borderBottomEndRadius="base" p={2} minW={64} gap={2}>
      <HUDItem label="Zoom" value={`${round(stageAttrs.scale * 100, 2)}%`} />
      <HUDItem label="Document Size" value={`${document.width}×${document.height} px`} />
      <HUDItem label="Stage Pos" value={`${round(stageAttrs.x, 3)}, ${round(stageAttrs.y, 3)}`} />
      <HUDItem
        label="Stage Size"
        value={`${round(stageAttrs.width / stageAttrs.scale, 2)}×${round(stageAttrs.height / stageAttrs.scale, 2)} px`}
      />
      <HUDItem label="BBox Size" value={`${bbox.width}×${bbox.height} px`} />
      <HUDItem label="BBox Position" value={`${bbox.x}, ${bbox.y}`} />
      <HUDItem label="BBox Width % 8" value={round(bbox.width % 8, 2)} />
      <HUDItem label="BBox Height % 8" value={round(bbox.height % 8, 2)} />
      <HUDItem label="BBox X % 8" value={round(bbox.x % 8, 2)} />
      <HUDItem label="BBox Y % 8" value={round(bbox.y % 8, 2)} />
      <HUDItem
        label="Cursor Position"
        value={cursorPos ? `${round(cursorPos.x, 2)}, ${round(cursorPos.y, 2)}` : '?, ?'}
      />
      <HUDItem label="Is Drawing" value={isDrawing ? 'True' : 'False'} />
      <HUDItem label="Is Mouse Down" value={isMouseDown ? 'True' : 'False'} />
      <HUDItem
        label="Last Mouse Down Pos"
        value={lastMouseDownPos ? `${round(lastMouseDownPos.x, 2)}, ${round(lastMouseDownPos.y, 2)}` : '?, ?'}
      />
      <HUDItem
        label="Last Added Point"
        value={lastAddedPoint ? `${round(lastAddedPoint.x, 2)}, ${round(lastAddedPoint.y, 2)}` : '?, ?'}
      />
    </Flex>
  );
});

HeadsUpDisplay.displayName = 'HeadsUpDisplay';

const HUDItem = memo(({ label, value }: { label: string; value: string | number }) => {
  return (
    <Box display="inline-block" lineHeight={1}>
      <Text as="span">{label}: </Text>
      <Text as="span" fontWeight="semibold">
        {value}
      </Text>
    </Box>
  );
});

HUDItem.displayName = 'HUDItem';

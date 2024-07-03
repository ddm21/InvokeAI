import { useStore } from '@nanostores/react';
import { createMemoizedSelector } from 'app/store/createMemoizedSelector';
import { useAppSelector } from 'app/store/storeHooks';
import { selectCanvasV2Slice } from 'features/controlLayers/store/canvasV2Slice';
import type { CanvasEntity } from 'features/controlLayers/store/types';
import { selectDynamicPromptsSlice } from 'features/dynamicPrompts/store/dynamicPromptsSlice';
import { getShouldProcessPrompt } from 'features/dynamicPrompts/util/getShouldProcessPrompt';
import { $templates, selectNodesSlice } from 'features/nodes/store/nodesSlice';
import type { Templates } from 'features/nodes/store/types';
import { selectWorkflowSettingsSlice } from 'features/nodes/store/workflowSettingsSlice';
import { isInvocationNode } from 'features/nodes/types/invocation';
import { selectSystemSlice } from 'features/system/store/systemSlice';
import { activeTabNameSelector } from 'features/ui/store/uiSelectors';
import i18n from 'i18next';
import { forEach, upperFirst } from 'lodash-es';
import { useMemo } from 'react';
import { getConnectedEdges } from 'reactflow';

const LAYER_TYPE_TO_TKEY: Record<CanvasEntity['type'], string> = {
  control_adapter: 'controlLayers.globalControlAdapter',
  ip_adapter: 'controlLayers.globalIPAdapter',
  regional_guidance: 'controlLayers.regionalGuidance',
  layer: 'controlLayers.raster',
  inpaint_mask: 'controlLayers.inpaintMask',
};

const createSelector = (templates: Templates) =>
  createMemoizedSelector(
    [
      selectSystemSlice,
      selectNodesSlice,
      selectWorkflowSettingsSlice,
      selectDynamicPromptsSlice,
      selectCanvasV2Slice,
      activeTabNameSelector,
    ],
    (system, nodes, workflowSettings, dynamicPrompts, canvasV2, activeTabName) => {
      const { bbox } = canvasV2;
      const { model, positivePrompt } = canvasV2.params;

      const { isConnected } = system;

      const reasons: { prefix?: string; content: string }[] = [];

      // Cannot generate if not connected
      if (!isConnected) {
        reasons.push({ content: i18n.t('parameters.invoke.systemDisconnected') });
      }

      if (activeTabName === 'workflows') {
        if (workflowSettings.shouldValidateGraph) {
          if (!nodes.nodes.length) {
            reasons.push({ content: i18n.t('parameters.invoke.noNodesInGraph') });
          }

          nodes.nodes.forEach((node) => {
            if (!isInvocationNode(node)) {
              return;
            }

            const nodeTemplate = templates[node.data.type];

            if (!nodeTemplate) {
              // Node type not found
              reasons.push({ content: i18n.t('parameters.invoke.missingNodeTemplate') });
              return;
            }

            const connectedEdges = getConnectedEdges([node], nodes.edges);

            forEach(node.data.inputs, (field) => {
              const fieldTemplate = nodeTemplate.inputs[field.name];
              const hasConnection = connectedEdges.some(
                (edge) => edge.target === node.id && edge.targetHandle === field.name
              );

              if (!fieldTemplate) {
                reasons.push({ content: i18n.t('parameters.invoke.missingFieldTemplate') });
                return;
              }

              if (fieldTemplate.required && field.value === undefined && !hasConnection) {
                reasons.push({
                  content: i18n.t('parameters.invoke.missingInputForField', {
                    nodeLabel: node.data.label || nodeTemplate.title,
                    fieldLabel: field.label || fieldTemplate.title,
                  }),
                });
                return;
              }
            });
          });
        }
      } else {
        if (dynamicPrompts.prompts.length === 0 && getShouldProcessPrompt(positivePrompt)) {
          reasons.push({ content: i18n.t('parameters.invoke.noPrompts') });
        }

        if (!model) {
          reasons.push({ content: i18n.t('parameters.invoke.noModelSelected') });
        }

        canvasV2.controlAdapters.entities
          .filter((ca) => ca.isEnabled)
          .forEach((ca, i) => {
            const layerLiteral = i18n.t('controlLayers.layers_one');
            const layerNumber = i + 1;
            const layerType = i18n.t(LAYER_TYPE_TO_TKEY[ca.type]);
            const prefix = `${layerLiteral} #${layerNumber} (${layerType})`;
            const problems: string[] = [];
            // Must have model
            if (!ca.model) {
              problems.push(i18n.t('parameters.invoke.layer.controlAdapterNoModelSelected'));
            }
            // Model base must match
            if (ca.model?.base !== model?.base) {
              problems.push(i18n.t('parameters.invoke.layer.controlAdapterIncompatibleBaseModel'));
            }
            // Must have a control image OR, if it has a processor, it must have a processed image
            if (!ca.imageObject) {
              problems.push(i18n.t('parameters.invoke.layer.controlAdapterNoImageSelected'));
            } else if (ca.processorConfig && !ca.processedImageObject) {
              problems.push(i18n.t('parameters.invoke.layer.controlAdapterImageNotProcessed'));
            }
            // T2I Adapters require images have dimensions that are multiples of 64 (SD1.5) or 32 (SDXL)
            if (ca.adapterType === 't2i_adapter') {
              const multiple = model?.base === 'sdxl' ? 32 : 64;
              if (bbox.width % multiple !== 0 || bbox.height % multiple !== 0) {
                problems.push(i18n.t('parameters.invoke.layer.t2iAdapterIncompatibleDimensions', { multiple }));
              }
            }

            if (problems.length) {
              const content = upperFirst(problems.join(', '));
              reasons.push({ prefix, content });
            }
          });

        canvasV2.ipAdapters.entities
          .filter((ipa) => ipa.isEnabled)
          .forEach((ipa, i) => {
            const layerLiteral = i18n.t('controlLayers.layers_one');
            const layerNumber = i + 1;
            const layerType = i18n.t(LAYER_TYPE_TO_TKEY[ipa.type]);
            const prefix = `${layerLiteral} #${layerNumber} (${layerType})`;
            const problems: string[] = [];

            // Must have model
            if (!ipa.model) {
              problems.push(i18n.t('parameters.invoke.layer.ipAdapterNoModelSelected'));
            }
            // Model base must match
            if (ipa.model?.base !== model?.base) {
              problems.push(i18n.t('parameters.invoke.layer.ipAdapterIncompatibleBaseModel'));
            }
            // Must have an image
            if (!ipa.imageObject) {
              problems.push(i18n.t('parameters.invoke.layer.ipAdapterNoImageSelected'));
            }

            if (problems.length) {
              const content = upperFirst(problems.join(', '));
              reasons.push({ prefix, content });
            }
          });

        canvasV2.regions.entities
          .filter((rg) => rg.isEnabled)
          .forEach((rg, i) => {
            const layerLiteral = i18n.t('controlLayers.layers_one');
            const layerNumber = i + 1;
            const layerType = i18n.t(LAYER_TYPE_TO_TKEY[rg.type]);
            const prefix = `${layerLiteral} #${layerNumber} (${layerType})`;
            const problems: string[] = [];
            // Must have a region
            if (rg.objects.length === 0) {
              problems.push(i18n.t('parameters.invoke.layer.rgNoRegion'));
            }
            // Must have at least 1 prompt or IP Adapter
            if (rg.positivePrompt === null && rg.negativePrompt === null && rg.ipAdapters.length === 0) {
              problems.push(i18n.t('parameters.invoke.layer.rgNoPromptsOrIPAdapters'));
            }
            rg.ipAdapters.forEach((ipAdapter) => {
              // Must have model
              if (!ipAdapter.model) {
                problems.push(i18n.t('parameters.invoke.layer.ipAdapterNoModelSelected'));
              }
              // Model base must match
              if (ipAdapter.model?.base !== model?.base) {
                problems.push(i18n.t('parameters.invoke.layer.ipAdapterIncompatibleBaseModel'));
              }
              // Must have an image
              if (!ipAdapter.imageObject) {
                problems.push(i18n.t('parameters.invoke.layer.ipAdapterNoImageSelected'));
              }
            });
            if (problems.length) {
              const content = upperFirst(problems.join(', '));
              reasons.push({ prefix, content });
            }
          });

        canvasV2.layers.entities
          .filter((l) => l.isEnabled)
          .forEach((l, i) => {
            const layerLiteral = i18n.t('controlLayers.layers_one');
            const layerNumber = i + 1;
            const layerType = i18n.t(LAYER_TYPE_TO_TKEY[l.type]);
            const prefix = `${layerLiteral} #${layerNumber} (${layerType})`;
            const problems: string[] = [];

            if (problems.length) {
              const content = upperFirst(problems.join(', '));
              reasons.push({ prefix, content });
            }
          });
      }

      return { isReady: !reasons.length, reasons };
    }
  );

export const useIsReadyToEnqueue = () => {
  const templates = useStore($templates);
  const selector = useMemo(() => createSelector(templates), [templates]);
  const value = useAppSelector(selector);
  return value;
};

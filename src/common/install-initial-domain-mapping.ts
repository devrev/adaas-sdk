import { axiosClient } from '../http/axios-client';
import { AirdropEvent } from '../types/extraction';

import { InitialDomainMapping } from '../types/common';
import { serializeError } from '../logger/logger';

export async function installInitialDomainMapping(
  event: AirdropEvent,
  initialDomainMappingJson: InitialDomainMapping
): Promise<void> {
  const devrevEndpoint = event.execution_metadata.devrev_endpoint;
  const devrevToken = event.context.secrets.service_account_token;
  const snapInId = event.context.snap_in_id;

  if (!initialDomainMappingJson) {
    console.warn('No initial domain mapping found.');
    return;
  }

  // Get snap-in details
  const snapInResponse = await axiosClient.get(
    devrevEndpoint + '/internal/snap-ins.get',
    {
      headers: {
        Authorization: devrevToken,
      },
      params: {
        id: snapInId,
      },
    }
  );

  const importSlug = snapInResponse.data?.snap_in?.imports?.[0]?.name;
  const snapInSlug = snapInResponse.data?.snap_in?.snap_in_version?.slug;

  if (!importSlug || !snapInSlug) {
    const errorMessage = `No import slug or snap-in slug found. Snap-in response: ${snapInResponse.data}`;
    throw new Error(errorMessage);
  }

  const startingRecipeBlueprint =
    initialDomainMappingJson?.starting_recipe_blueprint;

  // Try to create a recipe blueprint
  let recipeBlueprintId;
  if (
    startingRecipeBlueprint &&
    Object.keys(startingRecipeBlueprint).length !== 0
  ) {
    try {
      const recipeBlueprintResponse = await axiosClient.post(
        `${devrevEndpoint}/internal/airdrop.recipe.blueprints.create`,
        {
          ...startingRecipeBlueprint,
        },
        {
          headers: {
            Authorization: devrevToken,
          },
        }
      );

      recipeBlueprintId = recipeBlueprintResponse.data.recipe_blueprint.id;

      console.log(
        'Successfully created recipe blueprint with id: ' + recipeBlueprintId
      );
    } catch (error) {
      console.warn(
        'Error while creating recipe blueprint. Continuing without it.',
        serializeError(error)
      );
    }
  }

  // Install the initial domain mappings
  const additionalMappings = initialDomainMappingJson.additional_mappings || {};
  const initialDomainMappingInstallResponse = await axiosClient.post(
    `${devrevEndpoint}/internal/airdrop.recipe.initial-domain-mappings.install`,
    {
      external_system_type: 'ADaaS',
      import_slug: importSlug,
      snap_in_slug: snapInSlug,
      ...(recipeBlueprintId && {
        starting_recipe_blueprint: recipeBlueprintId,
      }),
      ...additionalMappings,
    },
    {
      headers: {
        Authorization: devrevToken,
      },
    }
  );

  console.log(
    `Successfully installed initial domain mapping ${JSON.stringify(initialDomainMappingInstallResponse.data)}`
  );
}

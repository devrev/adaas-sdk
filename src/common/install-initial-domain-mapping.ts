import axios from 'axios';
import { AirdropEvent } from '../types/extraction';
import { InitialDomainMapping } from '../types/common';

export async function installInitialDomainMapping(
  event: AirdropEvent,
  initialDomainMappingJson: InitialDomainMapping
) {
  const devrevEndpoint = event.execution_metadata.devrev_endpoint;
  const devrevToken = event.context.secrets.service_account_token;
  const snapInVersionId = event.context.snap_in_version_id;

  if (!initialDomainMappingJson) {
    console.warn('No initial domain mapping found');
    return;
  }

  const snapInVersionResponse = await axios.get(
    devrevEndpoint + '/internal/snap-in-versions.get',
    {
      headers: {
        Authorization: devrevToken,
      },
      params: {
        id: snapInVersionId,
      },
    }
  );

  const importSlug = snapInVersionResponse.data.snap_in_version.imports[0].slug;
  const snapInSlug = snapInVersionResponse.data.snap_in_version.slug;
  const startingRecipeBlueprint =
    initialDomainMappingJson?.starting_recipe_blueprint;

  let recipeBlueprintId;
  if (
    startingRecipeBlueprint &&
    Object.keys(startingRecipeBlueprint).length !== 0
  ) {
    try {
      const recipeBlueprintResponse = await axios.post(
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
      console.error('Error while creating recipe blueprint', error);
    }
  }

  try {
    // 2. Install the initial domain mappings
    const additionalMappings =
      initialDomainMappingJson.additional_mappings || {};
    const initialDomainMappingInstallResponse = await axios.post(
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
      'Successfully installed initial domain mapping',
      initialDomainMappingInstallResponse.data
    );
  } catch (error) {
    console.error('Error while installing initial domain mapping', error);
    return;
  }
}

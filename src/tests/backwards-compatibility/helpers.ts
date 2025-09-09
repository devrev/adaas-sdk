import {
  ApiClass,
  ApiConstructor,
  ApiEnum,
  ApiEnumMember,
  ApiFunction,
  ApiItem,
  ApiModel,
  ApiProperty,
  ApiTypeAlias,
  Parameter
} from '@microsoft/api-extractor-model';

import * as fs from 'fs';
import * as path from 'path';

export const newApiJsonPath = path.join(__dirname, 'temp', 'ts-adaas.api.json');
export const currentApiJsonPath = path.join(__dirname, 'ts-adaas.api.json');


// Helper function to load API data
export const loadApiData = (): { newApiMembers: readonly ApiItem[], currentApiMembers: readonly ApiItem[] } => {
  if (!fs.existsSync(newApiJsonPath)) {
    throw new Error(
      'API reports not found. Run the generate-api-report test first.'
    );
  }


  const newApiModel = new ApiModel().loadPackage(newApiJsonPath);
  const newApiMembers = newApiModel.entryPoints[0].members;

  const currentApiModel = new ApiModel().loadPackage(currentApiJsonPath);
  const currentApiMembers = currentApiModel.entryPoints[0].members;

  return { newApiMembers, currentApiMembers };
};

// Helper functions for getting different kinds of items from the API members
export const getFunctions = (members: readonly ApiItem[]): ApiFunction[] => {
  return members.filter((m: ApiItem) => m instanceof ApiFunction && m.kind === 'Function') as ApiFunction[];
}

export const getConstructor = (members: readonly ApiItem[]): ApiConstructor => {
  return (members.filter((m: ApiItem) => m instanceof ApiConstructor && m.kind === 'Constructor') as ApiConstructor[])[0];
}

export const getEnums = (members: readonly ApiItem[]): ApiEnum[] => {
  return members.filter((m: ApiItem) => m instanceof ApiEnum && m.kind === 'Enum') as ApiEnum[];
}

export const getClasses = (members: readonly ApiItem[]): ApiClass[] => {
  return members.filter((m: ApiItem) => m instanceof ApiClass && m.kind === 'Class') as ApiClass[];
}

export const getProperties = (members: readonly ApiItem[]): ApiProperty[] => {
  return members.filter((m: ApiItem) => m instanceof ApiProperty && m.kind === 'Property') as ApiProperty[];
}

export const getTypes = (members: readonly ApiItem[]): ApiTypeAlias[] => {
  return members.filter((m: ApiItem) => m instanceof ApiTypeAlias && m.kind === 'TypeAlias') as ApiTypeAlias[];
}

export const checkFunctionCompatibility = (newFunction: ApiFunction | ApiConstructor, currentFunction: ApiFunction | ApiConstructor) => {
  const lengthOfPreviousParameters = currentFunction.parameters.length;

  it(`Function ${newFunction.displayName} should have at least as many parameters as the current function`, () => {
    expect(newFunction.parameters.length).toBeGreaterThanOrEqual(currentFunction.parameters.length);
  });

  it(`Function ${newFunction.displayName} should have parameters in the same order as the current function`, () => {
    const newFunctionParamNames = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.name);
    const currentFunctionParamNames = currentFunction.parameters.map((p: Parameter) => p.name);
    expect(newFunctionParamNames).toEqual(currentFunctionParamNames);
  });

  it(`Function ${newFunction.displayName} should have compatible parameter types with the current function`, () => {
    const newFunctionParamTypes = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.parameterTypeExcerpt.text);
    const currentFunctionParameterTypes = currentFunction.parameters.map((p: Parameter) => p.parameterTypeExcerpt.text);
    expect(newFunctionParamTypes).toEqual(currentFunctionParameterTypes);
  });
  
  // Check return type compatibility
  // This check fails if it's a constructor, as those don't have a return type
  if(currentFunction instanceof ApiFunction && newFunction instanceof ApiFunction){
    if(!currentFunction.returnTypeExcerpt?.isEmpty) {
      it(`Function ${newFunction.displayName} should have the same return type as the current function`, () => {
        expect(newFunction.returnTypeExcerpt.text).toEqual(currentFunction.returnTypeExcerpt.text);
      });
    }
  }

  it(`Function ${newFunction.displayName} should have all new parameters as optional`, () => {
    const newParameters = newFunction.parameters.slice(lengthOfPreviousParameters);
    expect(newParameters.every((p: Parameter) => p.isOptional)).toBe(true);
  });

  it(`Function ${newFunction.displayName} should not have any optional parameters that became required`, () => {
    const requiredParameters = newFunction.parameters.filter((p: Parameter) => !p.isOptional);
    const currentRequiredParameters = currentFunction.parameters.filter((p: Parameter) => !p.isOptional);
    expect(requiredParameters.length).toBeLessThanOrEqual(currentRequiredParameters.length);
  });
}

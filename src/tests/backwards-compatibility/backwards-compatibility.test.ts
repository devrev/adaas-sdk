import * as fs from 'fs';
import * as path from 'path';

import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from '@microsoft/api-extractor';

describe('Generate API report', () => {
  it('should generate an api report', () => {
    const apiExtractorJsonPath: string = path.join(
      __dirname,
      'api-extractor.json'
    );
    const extractorConfig: ExtractorConfig =
      ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath);

    const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: false,
    });

    if (extractorResult.succeeded) {
      console.log(`API Extractor completed successfully`);
      process.exitCode = 0;
    } else {
      console.error(
        `API Extractor completed with ${extractorResult.errorCount} errors` +
          ` and ${extractorResult.warningCount} warnings`
      );
      process.exitCode = 1;
    }
  });
});

describe('Validate API report', () => {
  let failure = false;
  const newApiMdPath = path.join(__dirname, 'temp', 'ts-adaas.md');
  const currentApiMdPath = path.join(__dirname, 'ts-adaas.md');
  const newApiJsonPath = path.join(__dirname, 'temp', 'ts-adaas.api.json');
  const currentApiJsonPath = path.join(__dirname, 'ts-adaas.api.json');

  afterEach(() => {
    // Check if current test failed
    if (expect.getState().currentTestName && 
        expect.getState().suppressedErrors?.length > 0) {
      failure = true;
    }
  });

  // Helper function to load API data
  const loadApiData = () => {
    if (!fs.existsSync(newApiJsonPath)) {
      throw new Error(
        'API reports not found. Run the generate-api-report test first.'
      );
    }

    const newApiJson = fs.readFileSync(newApiJsonPath, 'utf-8');
    const newApi = JSON.parse(newApiJson);
    const newApiMembers = newApi.members[0].members;

    const currentApiJson = fs.readFileSync(currentApiJsonPath, 'utf-8');
    const currentApi = JSON.parse(currentApiJson);
    const currentApiMembers = currentApi.members[0].members;

    return { newApiMembers, currentApiMembers };
  };

  describe('Exports', () => {
    it('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m: any) => m.name);
      const currentExports = currentApiMembers.map((m: any) => m.name);
      for (const exportName of currentExports) {
        expect(newExports).toContain(exportName);
      }
    });
  });

  it('should verify that all functions in current are still in new and are compatible', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();

    const newFunctions = newApiMembers.filter((m: any) => m.kind === 'Function');
    const currentFunctions = currentApiMembers.filter((m: any) => m.kind === 'Function');

    expect(newFunctions.length).toBeGreaterThanOrEqual(currentFunctions.length);

    for (const newFunction of newFunctions) {
      const currentFunction = currentFunctions.find((f: any) => f.name === newFunction.name);

      // Skip if function doesn't exist in current API
      if (!currentFunction) {
        continue;
      }

      checkFunctionCompatibility(newFunction, currentFunction);
    }

    // TODO: Check that optional promotion works only one way (no required parameters becoming optional, but optional parameters can become required)
    // TODO: Check that function overloads weren't removed
  });

  const checkFunctionCompatibility = (newFunction: any, currentFunction: any) => {
    const lengthOfPreviousParameters = currentFunction.parameters.length;

    // Verify that the number of parameters is the same or greater
    expect(newFunction.parameters.length).toBeGreaterThanOrEqual(currentFunction.parameters.length);

    // Verify that the parameters are in the same order
    const newFunctionParamNames = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: any) => p.parameterName);
    const currentFunctionParamNames = currentFunction.parameters.map((p: any) => p.parameterName);
    expect(newFunctionParamNames).toEqual(currentFunctionParamNames);
    // Verify that the parameter types are compatible
    const newFunctionParamTypes = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: any) => getValueFromTokenRange(p.parameterTypeTokenRange, newFunction.excerptTokens));
    const currentFunctionParameterTypes = currentFunction.parameters.map((p: any) => getValueFromTokenRange(p.parameterTypeTokenRange, currentFunction.excerptTokens));
    expect(newFunctionParamTypes).toEqual(currentFunctionParameterTypes);
    
    // Verify that the return type is compatible
    // This check fails if it's a constructor, as those don't have a return type
    if(currentFunction.returnTypeTokenRange) {
      expect(getValueFromTokenRange(newFunction.returnTypeTokenRange, newFunction.excerptTokens)).toEqual(getValueFromTokenRange(currentFunction.returnTypeTokenRange, currentFunction.excerptTokens));
    }

    // Verify that parameters are added to the end and are optional
    const newParameters = newFunction.parameters.slice(lengthOfPreviousParameters);
    expect(newParameters.every((p: any) => p.isOptional)).toBe(true);

    // Verify that no optional parameters became required
    const requiredParameters = newFunction.parameters.filter((p: any) => !p.isOptional);
    try {
      expect(requiredParameters.length).toBeLessThanOrEqual(currentFunction.parameters.filter((p: any) => !p.isOptional).length);
    } catch (error) {
      const currentRequiredParameters = currentFunction.parameters.filter((p: any) => !p.isOptional);
      const changedParameters = requiredParameters.filter((p: any) => !currentRequiredParameters.map((p: any) => p.parameterName).includes(p.parameterName));
      throw new Error(`The following optional argument became required in "${newFunction.name}": ${changedParameters.map((p: any) => p.parameterName).join(', ')}`);
    }
  }

  it('should verify that all classes in current are still in new and are compatible', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();

    const newClasses = newApiMembers.filter((m: any) => m.kind === 'Class');
    const currentClasses = currentApiMembers.filter((m: any) => m.kind === 'Class');

    for (const newClass of newClasses) {
      const currentClass = currentClasses.find((c: any) => c.name === newClass.name);

      // Skip if class doesn't exist in current API
      if (!currentClass) {
        continue;
      }

      const newClassProperties = newClass.members.filter((m: any) => m.kind === 'Property');
      const currentClassProperties = currentClass.members.filter((m: any) => m.kind === 'Property');

      // Verify no public properties were removed
      expect(newClassProperties.length).toBeGreaterThanOrEqual(currentClassProperties.length);

      // Verify no optional properties became required
      const requiredProperties = newClassProperties.filter((p: any) => !p.optional);
      expect(requiredProperties.length).toBeLessThanOrEqual(currentClassProperties.filter((p: any) => !p.optional).length);

      // Verify property names haven't changed
      const oldProperties = currentClassProperties;
      const newProperties = newClassProperties;
      for(const newProperty of newProperties) {
        const currentProperty = oldProperties.find((p: any) => p.name === newProperty.name);
        // If the property is new, there's no need to check for compatibility
        if(!currentProperty) {
          continue;
        }
        // Verify property types are compatible
        expect(newProperty.type).toEqual(currentProperty.type);
        // Verify that optional properties haven't become required
        expect(newProperty.optional).toEqual(currentProperty.optional);
      }

      // Check constructor signature compatibility (same rules as functions)
      const currentMethod = currentClass.members.find((m: any) => m.kind === 'Constructor');
      const newMethod = newClass.members.find((m: any) => m.kind === 'Constructor');
      checkFunctionCompatibility(newMethod, currentMethod);

      // Verify no public methods were removed
      const newClassMethods = newClass.members.filter((m: any) => m.kind === 'Method');
      const currentClassMethods = currentClass.members.filter((m: any) => m.kind === 'Method');
      expect(newClassMethods.length).toBeGreaterThanOrEqual(currentClassMethods.length);

      // Check that functions are compatible (same rules as functions)
      // Make sure to allow optional parameters to be added to the end
      for(const newMethod of newClassMethods) {
        const currentMethod = currentClassMethods.find((m: any) => m.name === newMethod.name);
        // If the method is new, there's no need to check for compatibility
        if(!currentMethod) {
          continue;
        }
        checkFunctionCompatibility(newMethod, currentMethod);
      }

      // TODO: Verify class inheritance hierarchy hasn't changed in breaking ways
    }
  });

  const getValueFromTokenRange = (tokenRange: {startIndex: number, endIndex: number}, tokens: string[]): string => {
    const { startIndex, endIndex } = tokenRange;
    const usefulTokens = tokens.slice(startIndex, endIndex);
    const returnType = usefulTokens.map((t: any) => t.text).join('');
    return returnType;
  }

  describe('Interfaces', () => {
    // TODO: Verify no properties were removed
    // TODO: Verify no optional properties became required
    // TODO: Verify property names haven't changed
    // TODO: Verify property types are compatible
    // TODO: Check that method signatures are compatible (if interface has methods)
    // TODO: Verify interface inheritance hierarchy hasn't changed
  });

  describe('Enums', () => {
    let newEnums: any[];
    let currentEnums: any[];

    beforeAll(() => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = newApiMembers.filter((m: any) => m.kind === 'Enum');
      currentEnums = currentApiMembers.filter((m: any) => m.kind === 'Enum');
    });

    it('should verify that all enum values in current are still in new and are compatible', () => {
      // TODO: Verify no enum values were removed
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: any) => e.name === newEnum.name);

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;
        expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);
        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: any) => v.name === currentEnumValue.name);
          try {
            expect(newEnumValue).toBeDefined();
          } catch (error) {
            throw new Error(`The following enum value was removed in "${newEnum.name}": ${currentEnumValue.name}`);
          }
        }
      }
    });
    // TODO: Verify numeric enum values haven't changed (if numeric enum)
    it('should verify that numeric enum values have not changed', () => {
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: any) => e.name === newEnum.name);
        const newEnumNumeric = newEnum.members.every((m: any) => typeof m === 'number');
        const currentEnumNumeric = currentEnum.members.every((m: any) => typeof m === 'number');

        // Check if enum types have changed
        expect(newEnumNumeric).toBe(currentEnumNumeric);

        const currentEnumValues = currentEnums.find((e: any) => e.name === newEnum.name)?.members;
        const newEnumValues = newEnum.members;
        expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);
        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: any) => v.name === currentEnumValue.name);
          try {
            const newValue = getValueFromTokenRange(newEnumValue.initializerTokenRange, newEnumValue.excerptTokens);
            const currentValue = getValueFromTokenRange(currentEnumValue.initializerTokenRange, currentEnumValue.excerptTokens);
            expect(newValue).toEqual(currentValue);
          } catch (error) {
            throw new Error(`The following numeric enum value was changed in "${newEnum.name}": ${currentEnumValue.name}`);
          }
        }
      }
    });
    // TODO: Check that new enum values were only added at the end (best practice)
   });

  describe('Types', () => {
    // TODO: Verify type aliases weren't removed
    // TODO: Verify union types didn't become more restrictive (no types removed from union)
    // TODO: Verify intersection types didn't become more permissive (no required types removed)
    // TODO: Check generic type parameter compatibility
  });

  describe('Method Signatures', () => {
    // TODO: Verify generic constraints haven't become more restrictive
    // TODO: Check that default parameter values are still compatible
    // TODO: Verify rest parameters (...args) compatibility
    // TODO: Check function signature overloads
  });

  describe('Generics', () => {
    // TODO: Verify generic type parameters weren't removed
    // TODO: Check that generic constraints didn't become more restrictive
    // TODO: Verify generic parameter names haven't changed (affects explicit type arguments)
    // TODO: Check variance compatibility (covariant/contravariant)
  });

  describe('Property Types', () => {
    // TODO: Check readonly properties didn't become mutable (or vice versa in breaking way)
    // TODO: Verify array types compatibility (T[] vs Array<T>)
    // TODO: Check Promise/async compatibility
    // TODO: Verify callback function signature compatibility
  });

  describe('Accessibility', () => {
    // TODO: Verify public members didn't become private/protected
    // TODO: Check that protected members didn't become private
    // TODO: Ensure no breaking changes in static vs instance members
  });

  afterAll(() => {
    // If there are any failures, don't update the current API baseline files
    if(failure) {
      return;
    }
    if (fs.existsSync(newApiMdPath) && fs.existsSync(newApiJsonPath)) {
      fs.copyFileSync(newApiMdPath, currentApiMdPath);
      fs.copyFileSync(newApiJsonPath, currentApiJsonPath);

      console.log(`Updated current API baseline files.`);
    } else {
      console.warn('No new API reports found.');
    }
  });
});

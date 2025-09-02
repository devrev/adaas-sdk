import * as fs from 'fs';
import * as path from 'path';

import {
  Extractor,
  ExtractorConfig,
  ExtractorResult,
} from '@microsoft/api-extractor';
import {
  ApiClass,
  ApiConstructor,
  ApiEnum,
  ApiEnumMember,
  ApiFunction,
  ApiItem,
  ApiModel,
  ApiProperty,
  Parameter
} from '@microsoft/api-extractor-model';

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
  const loadApiData = (): { newApiMembers: readonly ApiItem[], currentApiMembers: readonly ApiItem[] } => {
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
  const getFunctions = (members: readonly ApiItem[]): ApiFunction[] => {
    return members.filter((m: ApiItem) => m instanceof ApiFunction && m.kind === 'Function') as ApiFunction[];
  }
  const getConstructor = (members: readonly ApiItem[]): ApiConstructor => {
    return (members.filter((m: ApiItem) => m instanceof ApiConstructor && m.kind === 'Constructor') as ApiConstructor[])[0];
  }
  const getEnums = (members: readonly ApiItem[]): ApiEnum[] => {
    return members.filter((m: ApiItem) => m instanceof ApiEnum && m.kind === 'Enum') as ApiEnum[];
  }
  const getClasses = (members: readonly ApiItem[]): ApiClass[] => {
    return members.filter((m: ApiItem) => m instanceof ApiClass && m.kind === 'Class') as ApiClass[];
  }
  const getProperties = (members: readonly ApiItem[]): ApiProperty[] => {
    return members.filter((m: ApiItem) => m instanceof ApiProperty && m.kind === 'Property') as ApiProperty[];
  }

  describe('Exports', () => {
    it('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m) => m.displayName);
      const currentExports = currentApiMembers.map((m: any) => m.displayName);
      for (const exportName of currentExports) {
        expect(newExports).toContain(exportName);
      }
    });
  });

  it('should verify that all functions in current are still in new and are compatible', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();

    const newFunctions: ApiFunction[] = getFunctions(newApiMembers);
    const currentFunctions: ApiFunction[] = getFunctions(currentApiMembers);

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

  const checkFunctionCompatibility = (newFunction: ApiFunction | ApiConstructor, currentFunction: ApiFunction | ApiConstructor) => {
    const lengthOfPreviousParameters = currentFunction.parameters.length;

    // Verify that the number of parameters is the same or greater
    expect(newFunction.parameters.length).toBeGreaterThanOrEqual(currentFunction.parameters.length);

    // Verify that the parameters are in the same order
    const newFunctionParamNames = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.name);
    const currentFunctionParamNames = currentFunction.parameters.map((p: Parameter) => p.name);
    expect(newFunctionParamNames).toEqual(currentFunctionParamNames);
    // Verify that the parameter types are compatible
    const newFunctionParamTypes = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.parameterTypeExcerpt.text);
    const currentFunctionParameterTypes = currentFunction.parameters.map((p: Parameter) => p.parameterTypeExcerpt.text);
    expect(newFunctionParamTypes).toEqual(currentFunctionParameterTypes);
    
    // Verify that the return type is compatible
    // This check fails if it's a constructor, as those don't have a return type
    if(currentFunction instanceof ApiFunction && newFunction instanceof ApiFunction){
      if(!currentFunction.returnTypeExcerpt?.isEmpty) {
        expect(newFunction.returnTypeExcerpt.text).toEqual(currentFunction.returnTypeExcerpt.text);
      }
    }

    // Verify that parameters are added to the end and are optional
    const newParameters = newFunction.parameters.slice(lengthOfPreviousParameters);
    expect(newParameters.every((p: Parameter) => p.isOptional)).toBe(true);

    // Verify that no optional parameters became required
    const requiredParameters = newFunction.parameters.filter((p: Parameter) => !p.isOptional);
    try {
      expect(requiredParameters.length).toBeLessThanOrEqual(currentFunction.parameters.filter((p: Parameter) => !p.isOptional).length);
    } catch (error) {
      const currentRequiredParameters = currentFunction.parameters.filter((p: Parameter) => !p.isOptional);
      const changedParameters = requiredParameters.filter((p: Parameter) => !currentRequiredParameters.map((p: Parameter) => p.name).includes(p.name));
      throw new Error(`The following optional argument became required in "${newFunction.displayName}": ${changedParameters.map((p: any) => p.parameterName).join(', ')}`);
    }
  }

  it('should verify that all classes in current are still in new and are compatible', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();

    const newClasses: ApiClass[] = getClasses(newApiMembers);
    const currentClasses: ApiClass[] = getClasses(currentApiMembers);

    for (const newClass of newClasses) {
      const currentClass = currentClasses.find((c: ApiClass) => c.name === newClass.name);

      // Skip if class doesn't exist in current API
      if (!currentClass) {
        continue;
      }

      const newClassProperties: ApiProperty[] = getProperties(newClass.members);
      const currentClassProperties: ApiProperty[] = getProperties(currentClass.members);

      // Verify no public properties were removed
      expect(newClassProperties.length).toBeGreaterThanOrEqual(currentClassProperties.length);

      // Verify no optional properties became required
      const requiredProperties = newClassProperties.filter((p: ApiProperty) => !p.isOptional);
      expect(requiredProperties.length).toBeLessThanOrEqual(currentClassProperties.filter((p: ApiProperty) => !p.isOptional).length);

      // Verify property names haven't changed
      const oldProperties = currentClassProperties;
      const newProperties = newClassProperties;
      for(const newProperty of newProperties) {
        const currentProperty = oldProperties.find((p: ApiProperty) => p.name === newProperty.name);
        // If the property is new, there's no need to check for compatibility
        if(!currentProperty) {
          continue;
        }
        // Verify property types are compatible
        expect(newProperty.propertyTypeExcerpt.text).toEqual(currentProperty.propertyTypeExcerpt.text);
        // Verify that optional properties haven't become required
        expect(newProperty.isOptional).toEqual(currentProperty.isOptional);
      }

      // Check constructor signature compatibility (same rules as functions)
      const currentMethod = getConstructor(currentClass.members);
      const newMethod = getConstructor(newClass.members);
      checkFunctionCompatibility(newMethod, currentMethod);

      // Verify no public methods were removed
      const newClassMethods = getFunctions(newClass.members);
      const currentClassMethods = getFunctions(currentClass.members);
      expect(newClassMethods.length).toBeGreaterThanOrEqual(currentClassMethods.length);

      // Check that functions are compatible (same rules as functions)
      // Make sure to allow optional parameters to be added to the end
      for(const newMethod of newClassMethods) {
        const currentMethod = currentClassMethods.find((m: ApiFunction) => m.name === newMethod.name);
        // If the method is new, there's no need to check for compatibility
        if(!currentMethod) {
          continue;
        }
        checkFunctionCompatibility(newMethod, currentMethod);
      }

      // TODO: Verify class inheritance hierarchy hasn't changed in breaking ways
    }
  });

  describe('Interfaces', () => {
    // TODO: Verify no properties were removed
    // TODO: Verify no optional properties became required
    // TODO: Verify property names haven't changed
    // TODO: Verify property types are compatible
    // TODO: Check that method signatures are compatible (if interface has methods)
    // TODO: Verify interface inheritance hierarchy hasn't changed
  });

  describe('Enums', () => {
    let newEnums: ApiEnum[];
    let currentEnums: ApiEnum[];

    beforeAll(() => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);
    });

    it('should verify that all enum values in current are still in new and are compatible', () => {
      // TODO: Verify no enum values were removed
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: ApiEnum) => e.name === newEnum.name);

        // If it's a new enum, there's no need to check for compatibility
        if(!currentEnum) {
          continue;
        }

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;
        expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);

        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: ApiEnumMember) => v.name === currentEnumValue.name);

          // If it's a new enum value, there's no need to check for compatibility
          if(!newEnumValue) {
            continue;
          }

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
        const currentEnum = currentEnums.find((e: ApiEnum) => e.name === newEnum.name);

        // If it's a new enum, there's no need to check for compatibility
        if(!currentEnum) {
          continue;
        }

        const newEnumNumeric = newEnum.members.every((m: ApiEnumMember) => typeof m === 'number');
        const currentEnumNumeric = currentEnum.members.every((m: ApiEnumMember) => typeof m === 'number');

        // Check if enum types have changed
        expect(newEnumNumeric).toBe(currentEnumNumeric);

        const currentEnumValues = currentEnum.members;

        const newEnumValues = newEnum.members;
        expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);
        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: ApiEnumMember) => v.name === currentEnumValue.name);

          // If it's not defined, an existing value is missing from the new enum
          expect(newEnumValue).toBeDefined();

          try {
            // Both can be undefined, but they should always equal each other
            const newValue = newEnumValue!.initializerExcerpt?.text;
            const currentValue = currentEnumValue.initializerExcerpt?.text;
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

# Get the current version from the package.json
currentVersion=$(node -p "require('../../package.json').version")

if npm view @devrev/ts-adaas versions | grep -q "'$currentVersion'"; then
   echo "Version $currentVersion already exists"
else
   echo "Version $currentVersion does not exist."
   npm version patch
fi

#Version of rebuild.sh for x64-linux

ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`

echo "Building for ${ARCH}" 
cd ..; node-gyp --debug rebuild; 
cd tools;
cp ../build/Debug/WishApi.node ../bin/WishApi-${ARCH}.node;


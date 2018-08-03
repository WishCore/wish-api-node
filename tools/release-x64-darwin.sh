ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`

echo "Building for ${ARCH}" 
cd ..; node-gyp --release rebuild; cd tools;
cp ../build/Release/WishApi.node ../bin/WishApi-${ARCH}.node; 
strip ../bin/WishApi-${ARCH}.node
